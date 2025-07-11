const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");
const { activityMiddleware } = require("../../middleware/activity");

const getBalance = async (req, res) => {
    const user = req.user;

    try {
        const { accountnumber } = req.query;

        if (!accountnumber) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Account number is required",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Account number must be provided in the query parameters"]
            });
        }

        let query = {
            text: `SELECT COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) AS balance FROM skyeu."transaction"`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = ` WHERE accountnumber = $1`;
        query.values.push(accountnumber);
        let valueIndex = 2;

        Object.keys(req.query).forEach((key) => {
            if (key !== 'accountnumber' && key !== 'q' && key !== 'startdate' && key !== 'enddate') {
                whereClause += ` AND "${key}" = $${valueIndex}`;
                query.values.push(req.query[key]);
                valueIndex++;
            }
        });

        // Add date range filter if provided
        // if (req.query.startdate) {
        //     whereClause += ` AND "transactiondate" >= $${valueIndex}`;
        //     query.values.push(req.query.startdate);
        //     valueIndex++;
        // }

        if (req.query.enddate) {
            whereClause += ` AND "transactiondate" <= $${valueIndex}`;
            const endDate = new Date(req.query.enddate);
            endDate.setDate(endDate.getDate() + 1);
            query.values.push(endDate.toISOString().split('T')[0]);
            valueIndex++;
        }

        query.text += whereClause;

        const balanceResult = await pg.query(query);
        const balance = balanceResult.rows[0].balance;

        await activityMiddleware(req, user.id, 'Balance fetched successfully', 'BALANCE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Balance fetched successfully",
            statuscode: StatusCodes.OK,
            data: { accountnumber, balance },
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching balance', 'BALANCE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getBalance };
