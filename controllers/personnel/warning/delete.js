const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteWarning = async (req, res) => {
    const user = req.user;
    const { id } = req.body;

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Warning ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Warning ID is required"]
        });
    }

    try {
        const query = {
            text: `UPDATE sky."warning" SET status = 'DELETED' WHERE id = $1 RETURNING *`,
            values: [id]
        };

        const result = await pg.query(query);
        const warning = result.rows[0];

        if (!warning) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Warning not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Warning not found"]
            });
        }

        await activityMiddleware(req, user.id, 'Warning deleted successfully', 'WARNING');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Warning deleted successfully",
            statuscode: StatusCodes.OK,
            data: warning,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting warning', 'WARNING');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteWarning };
