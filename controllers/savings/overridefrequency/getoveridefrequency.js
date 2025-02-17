
const { StatusCodes } = require("http-status-codes");
const { activityMiddleware } = require("../../../middleware/activity");
const pg = require("../../../db/pg");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getFrequencyOverrides = async (req, res) => {
    const user = req.user;

    try {
        // Fetch all branches
        const branchQuery = `SELECT id, branch FROM sky."Branch"`;
        const branchResult = await pg.query(branchQuery);
        const branches = branchResult.rows;

        // Fetch frequency overrides
        let query = {
            text: `SELECT * FROM sky."frequencyoverride"`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = '';
        let valueIndex = 1;
        Object.keys(req.query).forEach((key) => {
            if (key !== 'q') {
                if (whereClause) {
                    whereClause += ` AND `;
                } else {
                    whereClause += ` WHERE `;
                }
                whereClause += `"${key}" = $${valueIndex}`;
                query.values.push(req.query[key]);
                valueIndex++;
            }
        });

        // Add search query if provided
        if (req.query.q) {
            const searchConditions = `
                savingsproductid::text ILIKE $${valueIndex} OR 
                compulsorydepositfrequency ILIKE $${valueIndex} OR 
                branch::text ILIKE $${valueIndex} OR 
                status ILIKE $${valueIndex}
            `;
            if (whereClause) {
                whereClause += ` AND (${searchConditions})`;
            } else {
                whereClause += ` WHERE (${searchConditions})`;
            }
            query.values.push(`%${req.query.q}%`);
            valueIndex++;
        }

        query.text += whereClause;

        // Add pagination
        const searchParams = new URLSearchParams(req.query);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
        const offset = (page - 1) * limit;

        query.text += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
        query.values.push(limit, offset);

        const result = await pg.query(query);
        const frequencyOverrides = result.rows;

        // Create a template with all branches and their frequency overrides
        const frequencyOverridesTemplate = branches.map(branch => {
            const override = frequencyOverrides.find(fo => fo.branch === branch.id);
            return {
                branchid: branch.id, // Add branchid to the result
                branch: branch.branch,
                savingsproductid: override ? override.savingsproductid : null,
                compulsorydepositfrequency: override ? override.compulsorydepositfrequency : null,
                status: override ? override.status : 'ACTIVE'
            };
        });

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM sky."frequencyoverride" ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = divideAndRoundUp(total, limit);

        await activityMiddleware(req, user.id, 'Frequency overrides fetched successfully', 'FREQUENCY_OVERRIDE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Frequency overrides fetched successfully",
            statuscode: StatusCodes.OK,
            data: frequencyOverridesTemplate,
            pagination: {
                total: Number(total),
                pages,
                page, 
                limit
            },
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching frequency overrides', 'FREQUENCY_OVERRIDE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getFrequencyOverrides };
