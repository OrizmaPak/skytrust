const { StatusCodes } = require("http-status-codes");
const { activityMiddleware } = require("../../../middleware/activity");
const pg = require("../../../db/pg");
const { addOneDay } = require("../../../utils/expiredate");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getUsehurs = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `SELECT * FROM sky."User"`,
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
            // Fetch column names from the 'User' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'User'
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

        // Add startdate and enddate (commented out)
        // const startdate = req.query.startdate || '';
        // const enddate = req.query.enddate || '';
        // if (startdate && enddate) {
        //     const adjustedStartdate = addOneDay(startdate);
        //     const adjustedEnddate = addOneDay(enddate);
        //     if (whereClause) {
        //         whereClause += ` AND date BETWEEN $${valueIndex} AND $${valueIndex + 1}`;
        //     } else {
        //         whereClause += ` WHERE date BETWEEN $${valueIndex} AND $${valueIndex + 1}`;
        //     }
        //     query.values.push(adjustedStartdate, adjustedEnddate);
        //     valueIndex += 2;
        // } else if (startdate) {
        //     const adjustedStartdate = addOneDay(startdate);
        //     if (whereClause) {
        //         whereClause += ` AND date >= $${valueIndex}`;
        //     } else {
        //         whereClause += ` WHERE date >= $${valueIndex}`;
        //     }
        //     query.values.push(adjustedStartdate);
        //     valueIndex++;
        // } else if (enddate) {
        //     const adjustedEnddate = addOneDay(enddate);
        //     if (whereClause) {
        //         whereClause += ` AND date <= $${valueIndex}`;
        //     } else {
        //         whereClause += ` WHERE date <= $${valueIndex}`;
        //     }
        //     query.values.push(adjustedEnddate);
        //     valueIndex++;
        // }

        query.text += whereClause;

        // Add pagination
        const searchParams = new URLSearchParams(req.query);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
        const offset = (page - 1) * limit;

        query.text += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
        query.values.push(limit, offset);

        const result = await pg.query(query);
        const users = result.rows.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM sky."User" ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
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

module.exports = { getUsers };
