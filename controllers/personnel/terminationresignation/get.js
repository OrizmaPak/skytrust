const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getTerminationResignation = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `
                SELECT tr.*, 
                       CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS personnelname
                FROM skyeu."terminationresignation" tr
                JOIN skyeu."User" u ON tr.userid = u.id
            `,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = '';  
        let valueIndex = 1;
        Object.keys(req.query).forEach((key) => {
            if (key !== 'q' && key !== 'startdate' && key !== 'enddate') {
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

        // Add date range filter if provided
        if (req.query.startdate) {
            if (whereClause) {
                whereClause += ` AND `;
            } else {
                whereClause += ` WHERE `;
            }
            whereClause += `"dateadded" >= $${valueIndex}`;
            query.values.push(req.query.startdate);
            valueIndex++;
        }

        if (req.query.enddate) {
            if (whereClause) {
                whereClause += ` AND `;
            } else {
                whereClause += ` WHERE `;
            }
            whereClause += `"dateadded" <= $${valueIndex}`;
            query.values.push(req.query.enddate);
            valueIndex++;
        }

        // Add search query if provided
        if (req.query.q) {
            // Fetch column names from the 'terminationresignation' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'sky' AND table_name = 'terminationresignation'
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

        const result = await pg.query(query);
        const terminationResignations = result.rows;

        await activityMiddleware(req, user.id, 'Termination/Resignation records fetched successfully', 'TERMINATION_RESIGNATION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Termination/Resignation records fetched successfully",
            statuscode: StatusCodes.OK,
            data: terminationResignations,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching termination/resignation records', 'TERMINATION_RESIGNATION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getTerminationResignation };
