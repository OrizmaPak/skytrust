const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const blockPin = async (req, res) => {
    const user = req.user;
    const id = user.id;

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "User ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        // Update the User's pin to 'BLOCKED'
        const updateQuery = {
            text: `UPDATE skyeu."User" SET pin = 'BLOCKED' WHERE id = $1`,
            values: [id]
        };
        await pg.query(updateQuery);

        // Log activity
        await activityMiddleware(req, id, 'Pin blocked successfully', 'PIN_BLOCK');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Pin blocked successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error("Error blocking pin:", error);
        await activityMiddleware(req, id, 'Error blocking pin', 'PIN_BLOCK_ERROR');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal server error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { blockPin };
