    const { StatusCodes } = require("http-status-codes");
    const { activityMiddleware } = require("../../../middleware/activity");
    const pg = require("../../../db/pg");
    const { addOneDay } = require("../../../utils/expiredate");
    const { divideAndRoundUp } = require("../../../utils/pageCalculator");
    
    const findUsers = async (req, res) => {
        const user = req.user;
    
        try {
            let query = {
                text: `SELECT * FROM sky."User"`,
                values: []
            };
    
            // Determine access level based on user role and permissions
            let whereClause = '';

            console.log(user.branch)
    
            // Fetch column names from the 'User' table across all schemas
            const { rows: columns } = await pg.query(`
                SELECT column_name, table_schema
                FROM information_schema.columns
                WHERE table_name = 'User'
            `);

            // Dynamically build the WHERE clause based on query parameters
            let valueIndex = query.values.length + 1;
            Object.keys(req.query).forEach((key) => {
                const column = columns.find(col => col.column_name === key);
                if (column) {
                    whereClause += whereClause ? ` AND ` : ` WHERE `;
                    whereClause += `"${column.table_schema}"."User"."${key}" = $${valueIndex}`;
                    query.values.push(req.query[key]);
                    valueIndex++;
                }
            });
    
            // Add search query if provided
            if (req.query.q) {
                // Fetch column names from the 'User' table
                const { rows: columns } = await pg.query(`
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'User'
                `);
    
                const cols = columns.map(row => row.column_name);
    
                // Generate the dynamic SQL query
                const searchConditions = cols.map(col => `${col}::text ILIKE $${valueIndex}`).join(' OR ');
                whereClause += whereClause ? ` AND (${searchConditions})` : ` WHERE (${searchConditions})`;
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
            console.log(query)
            const result = await pg.query(query);
            const users = result.rows.map(user => {
                const { password, ...userWithoutPassword } = user;
                return userWithoutPassword;
            });

            // Fetch branch names for each user
            for (let user of users) {
                const { rows: [branch] } = await pg.query(`SELECT branch FROM sky."Branch" WHERE id = $1`, [user.branch]);
                user.branchname = branch ? branch.branch : null;
            }
    
            // Get total count for pagination
            const countQuery = {
                text: `SELECT COUNT(*) FROM sky."User" ${whereClause}`,
                values: whereClause ? query.values.slice(0, -2) : []
            };
            const { rows: [{ count: total }] } = await pg.query(countQuery);
            const pages = divideAndRoundUp(total, limit);
    
            await activityMiddleware(req, user.id, 'Users fetched successfully', 'USER');
    
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Users fetched successfully",
                statuscode: StatusCodes.OK,
                data: users,
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
            await activityMiddleware(req, user.id, 'An unexpected error occurred fetching users', 'USER');
    
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "An unexpected error occurred",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: [error.message]
            });
        }
    };
    
    module.exports = { findUsers };
