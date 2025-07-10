const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");
const { activityMiddleware } = require("../../middleware/activity");

const resetPin = async (req, res) => {
    const {id} = req.body;

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
        // Update the user's pin to an empty string
        const query = {
            text: `UPDATE sky."User" SET pin = '' WHERE id = $1`,
            values: [userId]
        };

        const result = await pg.query(query);

        if (result.rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "User not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        await activityMiddleware(req, userId, 'User PIN reset successfully', 'USER');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "User PIN reset successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, userId, 'An unexpected error occurred resetting user PIN', 'USER');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { resetPin };
