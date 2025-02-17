const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteQualification = async (req, res) => {
    const user = req.user;
    const { id } = req.body;

    try {
        // Check if the qualification exists
        const { rowCount } = await pg.query({
            text: `SELECT * FROM sky."qualification" WHERE "id" = $1`,
            values: [id]
        });

        if (rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Qualification not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        // Delete the qualification
        await pg.query({
            text: `DELETE FROM sky."qualification" WHERE "id" = $1`,
            values: [id]
        });

        await activityMiddleware(req, user.id, 'Qualification deleted successfully', 'QUALIFICATION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Qualification deleted successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting qualification', 'QUALIFICATION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteQualification };  
