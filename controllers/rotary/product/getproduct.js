const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getRotaryProduct = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `SELECT * FROM sky."rotaryProduct"`,
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
            // Fetch column names from the 'rotaryProduct' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'rotaryProduct'
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
        const rotaryProducts = result.rows;

        // Fetch member names and product officer names
        for (let product of rotaryProducts) {
            // Fetch member name
            if (product.member) {
                const memberIds = product.member.includes('||') ? product.member.split('||') : [product.member];
                const memberNames = [];
                for (const memberId of memberIds) {
                    const { rows: memberRows } = await pg.query({
                        text: `SELECT member FROM sky."DefineMember" WHERE id = $1`,
                        values: [memberId.trim()]
                    });
                    if (memberRows.length > 0) {
                        memberNames.push(memberRows[0].member);
                    }
                }
                product.membername = memberNames.join(', ');
            }

            // Fetch product officer name
            if (product.productofficer) {
                const { rows: officerRows } = await pg.query({
                    text: `SELECT firstname, lastname, othernames FROM sky."User" WHERE id = $1`,
                    values: [product.productofficer]
                });
                if (officerRows.length > 0) {
                    const { firstname, lastname, othernames } = officerRows[0];
                    product.productofficername = [firstname, lastname, othernames].filter(Boolean).join(' ');
                }
            }
        }

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM sky."rotaryProduct" ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = divideAndRoundUp(total, limit);

        await activityMiddleware(req, user.id, 'Rotary products fetched successfully', 'ROTARY_PRODUCT');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Rotary products fetched successfully",
            statuscode: StatusCodes.OK,
            data: rotaryProducts,
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
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching rotary products', 'ROTARY_PRODUCT');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null, 
            errors: [error.message]
        });
    }
};

module.exports = { getRotaryProduct };
