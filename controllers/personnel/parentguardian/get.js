const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getParentGuardians = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `SELECT pg.*, CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS personnelname 
                   FROM skyeu."parentguardians" pg 
                   JOIN skyeu."User" u ON pg.userid = u.id 
                   WHERE pg."status" = 'ACTIVE'`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = '';
        let valueIndex = 1;
        Object.keys(req.query).forEach((key) => {
            if (key !== 'q' && key !== 'page' && key !== 'limit') {
                if (whereClause) {
                    whereClause += ` AND `;
                } else {
                    whereClause += ` WHERE `;
                }
                whereClause += `pg."${key}" = $${valueIndex}`;
                query.values.push(req.query[key]);
                valueIndex++;
            }
        });

        // Add search query if provided
        if (req.query.q) {
            const searchConditions = [
                `pg."parentonename" ILIKE $${valueIndex}`,
                `pg."parenttwoname" ILIKE $${valueIndex}`,
                `pg."parentoneoccupation" ILIKE $${valueIndex}`,
                `pg."parenttwooccupation" ILIKE $${valueIndex}`,
                `CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) ILIKE $${valueIndex}`
            ].join(' OR ');

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
        const parentGuardians = result.rows;

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM skyeu."parentguardians" pg ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = Math.ceil(total / limit);

        await activityMiddleware(req, user.id, 'Parent/Guardians fetched successfully', 'PARENT_GUARDIAN');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Parent/Guardians fetched successfully",
            statuscode: StatusCodes.OK,
            data: parentGuardians,
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
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching parent/guardians', 'PARENT_GUARDIAN');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getParentGuardians };
