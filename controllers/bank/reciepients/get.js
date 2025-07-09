const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getRecipients = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `SELECT r.*, b.bank AS bankname FROM sky."reciepients" r JOIN sky."listofbanks" b ON r.bank = b.id`,
            values: []
        };

        // Start with default WHERE clause for active status
        let whereClause = ` WHERE r."status" = $1`;
        query.values.push('ACTIVE');
        let valueIndex = 2;

        // Dynamically build the WHERE clause based on query parameters targeting reciepients table
        Object.keys(req.query).forEach((key) => {
            if (key !== 'q' && ['id', 'fullname', 'accountnumber', 'bank', 'status'].includes(key)) {
                whereClause += ` AND r."${key}" = $${valueIndex}`; 
                query.values.push(req.query[key]);
                valueIndex++;
            } 
        });

        // Add search query if provided
        if (req.query.q) {
            const searchConditions = ['r.fullname', 'r.accountnumber', 'b.bank'].map(col => `${col}::text ILIKE $${valueIndex}`).join(' OR ');
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
        const recipients = result.rows;

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM sky."reciepients" r JOIN sky."listofbanks" b ON r.bank = b.id ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = Math.ceil(total / limit);

        await activityMiddleware(req, user.id, 'Recipients fetched successfully', 'RECIPIENT');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Recipients fetched successfully",
            statuscode: StatusCodes.OK,
            data: recipients,
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
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching recipients', 'RECIPIENT');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getRecipients };