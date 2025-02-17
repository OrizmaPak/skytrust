const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getAccounts = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `SELECT s.*, 
                          CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS useridname,
                          b.branch AS branchname,
                          rp.registrationpoint AS registrationpointname,
                          CONCAT(ao.firstname, ' ', ao.lastname, ' ', COALESCE(ao.othernames, '')) AS accountofficername,
                          sp.productname AS savingsproduct,
                          dm.member AS membername
                   FROM sky."savings" s 
                   JOIN sky."User" u ON s.userid = u.id
                   JOIN sky."Branch" b ON s.branch = b.id
                   LEFT JOIN sky."Registrationpoint" rp ON s.registrationpoint = rp.id
                   LEFT JOIN sky."User" ao ON CAST(s.accountofficer AS INTEGER) = ao.id
                   LEFT JOIN sky."savingsproduct" sp ON s.savingsproductid = sp.id
                   LEFT JOIN sky."DefineMember" dm ON s.member = dm.id`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = [];
        let valueIndex = 1;
        Object.keys(req.query).forEach((key) => {
            if (key !== 'q' && key !== 'page' && key !== 'limit') {
                whereClause.push(`s."${key}" = $${valueIndex}`);
                query.values.push(req.query[key]);
                valueIndex++;
            }
        });

        if (whereClause.length > 0) {
            query.text += ` WHERE ` + whereClause.join(' AND ');
        }

        // Add search query if provided
        if (req.query.q) {
            // Fetch column names from the 'savings' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'savings'
            `);

            const cols = columns.map(row => row.column_name);

            // Generate the dynamic SQL query
            const searchConditions = cols.map(col => `s.${col}::text ILIKE $${valueIndex}`).join(' OR ');
            if (whereClause.length > 0) {
                query.text += ` AND (${searchConditions})`;
            } else {
                query.text += ` WHERE (${searchConditions})`;
            }
            query.values.push(`%${req.query.q}%`);
            valueIndex++;
        }

        // Add pagination
        const searchParams = new URLSearchParams(req.query);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
        const offset = (page - 1) * limit;

        query.text += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
        query.values.push(limit, offset);

        const result = await pg.query(query);
        const accounts = result.rows;

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM sky."savings" s ${whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : ''}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = divideAndRoundUp(total, limit);

        await activityMiddleware(req, user.id, 'Accounts fetched successfully', 'ACCOUNT');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Accounts fetched successfully",
            statuscode: StatusCodes.OK,
            data: accounts,
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
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching accounts', 'ACCOUNT');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getAccounts };
   