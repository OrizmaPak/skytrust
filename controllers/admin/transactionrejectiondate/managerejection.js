const { StatusCodes } = require("http-status-codes"); // Importing StatusCodes for HTTP status codes
const pg = require("../../../db/pg"); // Importing PostgreSQL client
const { activityMiddleware } = require("../../../middleware/activity"); // Importing activity middleware for tracking

// Function to manage transaction rejection dates
const managerejection = async (req, res) => {
    const { id, rejectiondate, reason } = req.body; // Extracting request body parameters

    // Validating rejection date
    if (!rejectiondate || isNaN(Date.parse(rejectiondate)) || new Date(rejectiondate) < new Date()) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Rejection date is compulsory, should be a valid date, and cannot be a past date",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        let query;
        let params;

        // Determining the query based on the presence of id
        if (id) {
            query = `UPDATE skyeu."Rejecttransactiondate" SET rejectiondate = COALESCE($1, rejectiondate), reason = COALESCE($2, reason), status = COALESCE($3, status) WHERE id = $4`;
            params = [rejectiondate, reason, req.body.status, id];
        } else {
            // Checking if rejection date already exists
            const rejectionDateExists = await pg.query(`SELECT * FROM skyeu."Rejecttransactiondate" WHERE rejectiondate = $1`, [rejectiondate]);
            if (rejectionDateExists.rowCount > 0) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Rejection date already exists",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
            query = `INSERT INTO skyeu."Rejecttransactiondate" (rejectiondate, reason) VALUES ($1, $2)`;
            params = [rejectiondate, reason];
        }

        // Executing the query
        const { rowCount } = await pg.query(query, params);

        // Handling the result of the query execution
        if (rowCount > 0) {
            await activityMiddleware(res, req.user.id, `${id ? 'Updated' : 'Created'} transaction rejection date`, 'TRANSACTION_REJECTION_DATE');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: `Registration Dated ${id ? 'Updated' : 'Created'} successfully`,
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            });
        } else {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "An unexpected error occurred",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: []
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}

module.exports = {
    managerejection
};
