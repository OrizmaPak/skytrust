const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

const getTransactionRejectionDate = async (req, res) => {
    try {
        let query = {
            text: `SELECT * FROM skyeu."Rejecttransactiondate"`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = ' WHERE "status" = $1';
        let valueIndex = 2;
        query.values.push('ACTIVE');

        Object.keys(req.query).forEach((key) => {
            if (key !== 'q') {
                whereClause += ` AND "${key}" = $${valueIndex}`;
                query.values.push(req.query[key]);
                valueIndex++;
            }
        });

        // Add search query if provided
        if (req.query.q) {
            // Fetch column names from the 'Rejecttransactiondate' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'sky' AND table_name = 'Rejecttransactiondate'
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
        const rejectionDates = result.rows; 

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM skyeu."Rejecttransactiondate" ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = Math.ceil(total / limit);

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Transaction rejection dates fetched successfully",
            statuscode: StatusCodes.OK,
            data: rejectionDates,
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

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
}

module.exports = {
    getTransactionRejectionDate
};
