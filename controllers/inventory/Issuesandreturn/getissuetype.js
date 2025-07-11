const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const pg = require("../../../db/pg"); // Import PostgreSQL database connection

// Function to handle GET issue type request
const getIssueType = async (req, res) => {
    try {
        const issueTypes = await pg.query(`SELECT * FROM skyeu."issue" WHERE status = 'ACTIVE'`);
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Issue types retrieved successfully",
            statuscode: StatusCodes.OK,
            data: issueTypes.rows,
            errors: []
        });
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
    getIssueType
};
