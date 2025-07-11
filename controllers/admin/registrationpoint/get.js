const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const pg = require("../../../db/pg"); // Import PostgreSQL database connection
const { activityMiddleware } = require("../../../middleware/activity"); // Import activity middleware for tracking

// Function to handle GET request for registration points
const getRegistrationPoint = async (req, res) => {
    // Extract id, status, and branch from query parameters with default status as 'ACTIVE'
    let { id, status="ACTIVE", branch } = req.query;
    const user = req.user; // Extract user from request

    try {
        // Base query to select all registration points with branch name
        let queryString = `
            SELECT rp.*, b.branch AS branchname
            FROM skyeu."Registrationpoint" rp
            LEFT JOIN skyeu."Branch" b ON rp.branch = b.id
            WHERE 1=1
        `;
        let params = [];

        // Determine access level based on user role and permissions
        if (user.role !== 'SUPERADMIN' && (!user.permissions || !user.permissions.includes('CHANGE BRANCH'))) {
            // Restrict to registration points from the same branch
            queryString += ` AND rp.branch = $${params.length + 1}`;
            params.push(user.branch);
        }

        // Add id condition to the query if id is provided
        if (id) {
            queryString += ` AND rp.id = $${params.length + 1}`;
            params.push(id);
        }
        // Add status condition to the query if status is provided
        if (status) {
            queryString += ` AND rp.status = $${params.length + 1}`;
            params.push(status);
        }
        // Add branch condition to the query if branch is provided
        if (branch) {
            queryString += ` AND rp.branch = $${params.length + 1}`;
            params.push(branch);
        }

        // Execute the query with parameters
        const { rows: registrationPoints } = await pg.query(queryString, params);

        // Check if any registration points are found
        if (registrationPoints.length > 0) {
            // Log activity if registration points are found
            await activityMiddleware(req, req.user.id, 'Registration points fetched successfully', 'REGISTRATIONPOINT');
            // Return success response with registration points
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Registration points fetched successfully",
                statuscode: StatusCodes.OK,
                data: registrationPoints,
                errors: []
            });
        } else {
            // Log activity if no registration points are found
            await activityMiddleware(req, req.user.id, 'No registration points found', 'REGISTRATIONPOINT');
            // Return success response with no data
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "No registration points found",
                statuscode: StatusCodes.OK,
                data: [],
                errors: []
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err); // Log any unexpected error
        // Log activity for unexpected error
        await activityMiddleware(req, req.user.id, 'An unexpected error occurred fetching registration points', 'REGISTRATIONPOINT');
        // Return error response for unexpected error
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
    getRegistrationPoint
};
