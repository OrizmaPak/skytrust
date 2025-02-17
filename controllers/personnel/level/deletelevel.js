const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteLevel = async (req, res) => {
    const user = req.user;
    const { id } = req.body;

    try {
        // Check if the level exists
        const { rows: levelRows } = await pg.query(
            `SELECT * FROM sky."level" WHERE id = $1 AND status = 'ACTIVE'`,
            [id]
        );

        if (levelRows.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Level not found or already deleted",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }
  
        // Check if any user is associated with this level
        const { rows: userRows } = await pg.query(
            `SELECT * FROM sky."User" WHERE level = $1 AND status = 'ACTIVE'`,
            [id]
        );

        if (userRows.length > 0) {
            return res.status(StatusCodes.CONFLICT).json({
                status: false,
                message: "Cannot delete level as it is associated with active users",
                statuscode: StatusCodes.CONFLICT,
                data: null,
                errors: []
            });
        }

        // Update the level status to DELETED
        await pg.query(
            `UPDATE sky."level" SET status = 'DELETED' WHERE id = $1`,
            [id]
        );

        await activityMiddleware(req, user.id, 'Level deleted successfully', 'LEVEL');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Level deleted successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting level', 'LEVEL');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteLevel };
 