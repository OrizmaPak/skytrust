const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteLeave = async (req, res) => {
    const user = req.user;
    const { id } = req.body;

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Leave ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Leave ID is required"]
        });
    }

    try {
        const query = {
            text: `UPDATE sky."leave" SET status = 'DELETED' WHERE id = $1 RETURNING *`,
            values: [id]
        };

        const result = await pg.query(query);
        const leave = result.rows[0];

        if (!leave) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Leave not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Leave not found"]
            });
        }

        await activityMiddleware(req, user.id, 'Leave deleted successfully', 'LEAVE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Leave deleted successfully",
            statuscode: StatusCodes.OK,
            data: leave,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting leave', 'LEAVE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteLeave };
