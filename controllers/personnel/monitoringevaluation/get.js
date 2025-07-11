const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getMonitoringEvaluations = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `
                SELECT me.*, 
                       CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS personnelname
                FROM skyeu."monitoringevaluation" me
                JOIN skyeu."User" u ON me.userid = u.id
                WHERE me.status = 'ACTIVE'
            `,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = '';  
        let valueIndex = 1;
        Object.keys(req.query).forEach((key) => {
            if (key !== 'q' && key !== 'startdate' && key !== 'enddate') {
                if (req.query[key]) {
                    whereClause += ` AND me."${key}" = $${valueIndex}`;
                    query.values.push(req.query[key]);
                    valueIndex++;
                }
            }
        });

        // Add date range filter if provided
        if (req.query.startdate) {
            whereClause += ` AND me."dateadded" >= $${valueIndex}`;
            query.values.push(req.query.startdate);
            valueIndex++;
        }

        if (req.query.enddate) {
            whereClause += ` AND me."dateadded" <= $${valueIndex}`;
            query.values.push(req.query.enddate);
            valueIndex++;
        }

        // Add search query if provided
        if (req.query.q) {
            // Fetch column names from the 'monitoringevaluation' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'sky' AND table_name = 'monitoringevaluation'
            `);

            const cols = columns.map(row => row.column_name);

            // Generate the dynamic SQL query
            const searchConditions = cols.map(col => `${col}::text ILIKE $${valueIndex}`).join(' OR ');
            whereClause += ` AND (${searchConditions})`;
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
        const monitoringEvaluations = result.rows;

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM skyeu."monitoringevaluation" WHERE status = 'ACTIVE' ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = divideAndRoundUp(total, limit);

        await activityMiddleware(req, user.id, 'Monitoring Evaluations fetched successfully', 'MONITORING_EVALUATION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Monitoring Evaluations fetched successfully",
            statuscode: StatusCodes.OK,
            data: monitoringEvaluations,
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
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching monitoring evaluations', 'MONITORING_EVALUATION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getMonitoringEvaluations };
