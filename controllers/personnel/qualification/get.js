const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getQualifications = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `SELECT q.*, CONCAT(p.firstname, ' ', p.lastname, ' ', COALESCE(p.othernames, '')) AS personnelname
                   FROM sky."qualification" q
                   JOIN sky."User" p ON q.userid = p.id`,
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
            // Fetch column names from the 'qualification' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'qualification'
            `);

            const cols = columns.map(row => row.column_name);

            // Generate the dynamic SQL query
            const searchConditions = cols.map(col => `${col}::text ILIKE $${valueIndex}`).join(' OR ');
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
        const qualifications = result.rows;

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM sky."qualification" ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = Math.ceil(total / limit);

        await activityMiddleware(req, user.id, 'Qualifications fetched successfully', 'QUALIFICATION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Qualifications fetched successfully",
            statuscode: StatusCodes.OK,
            data: qualifications,
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
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching qualifications', 'QUALIFICATION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getQualifications };
