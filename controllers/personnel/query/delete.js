const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteQuery = async (req, res) => {
    const user = req.user;
    const { id } = req.body;

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Query ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Missing Query ID"]
        });
    }

    try {
        const { rowCount } = await pg.query({
            text: `UPDATE sky."query" SET "status" = 'DELETED' WHERE "id" = $1 AND "status" = 'ACTIVE'`,
            values: [id]
        });

        if (rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Query not found or already deleted",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Query not found or already deleted"]
            });
        }

        await activityMiddleware(req, user.id, 'Query deleted successfully', 'QUERY');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Query deleted successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting query', 'QUERY');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteQuery };
