// Importing required modules and middleware
const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

// Function to get cashier limits
const getCashierLimit = async (req, res) => {
    // Extracting cashier, status, and id from query parameters
    let { cashier, status, id } = req.query;
    const user = req.user;

    try {
        // Building the SQL query dynamically based on query parameters
        let queryString = `
            SELECT skyeu."Cashierlimit".*, CONCAT(skyeu."User".firstname, ' ', skyeu."User".lastname, ' ', COALESCE(skyeu."User".othernames, '')) AS cashiername
            FROM skyeu."Cashierlimit"
            LEFT JOIN skyeu."User" ON skyeu."Cashierlimit".cashier = skyeu."User".id
            WHERE 1=1
        `;
        let params = [];

        // Determine access level based on user role and permissions
        if (user.role !== 'SUPERADMIN' && (!user.permissions || !user.permissions.includes('CHANGE BRANCH'))) {
            // Restrict to users from the same branch
            queryString += ` AND skyeu."User".branch = $${params.length + 1}`;
            params.push(user.branch);
        }

        // Adding id condition to the query if provided
        if (id) {
            queryString += ` AND skyeu."Cashierlimit".id = $${params.length + 1}`;
            params.push(id);
        }
        // Adding cashier condition to the query if provided
        if (cashier) {
            queryString += ` AND skyeu."Cashierlimit".cashier = $${params.length + 1}`;
            params.push(cashier);
        }
        // Adding status condition to the query if provided
        if (status) {
            queryString += ` AND skyeu."Cashierlimit".status = $${params.length + 1}`;
            params.push(status);
        }

        // Executing the query
        const { rows: cashierLimits } = await pg.query(queryString, params);

        // Handling the response based on the number of cashier limits found
        if (cashierLimits.length > 0) {
            // Logging activity for successful fetch
            await activityMiddleware(req, req.user.id, 'Cashier limits fetched successfully', 'CASHIER_LIMIT');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Cashier limits fetched successfully",
                statuscode: StatusCodes.OK,
                data: cashierLimits,
                errors: []
            });
        } else {
            // Logging activity for no cashier limits found
            await activityMiddleware(req, req.user.id, 'No cashier limits found', 'CASHIER_LIMIT');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "No cashier limits found",
                statuscode: StatusCodes.OK,
                data: [],
                errors: []
            });
        }
    } catch (err) {
        // Logging and handling unexpected errors
        console.error('Unexpected Error:', err);
        await activityMiddleware(req, req.user.id, 'An unexpected error occurred fetching cashier limits', 'CASHIER_LIMIT');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}

// Exporting the function
module.exports = {
    getCashierLimit
};
