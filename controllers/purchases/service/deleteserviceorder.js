const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteServiceOrder = async (req, res) => {
    const user = req.user;
    const { reference } = req.body;

    if (!reference) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Reference is required.",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        const updateQuery = `UPDATE skyeu."Service" SET status = 'DELETED' WHERE reference = $1`;
        const result = await pg.query(updateQuery, [reference]);

        if (result.rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "No services found with the given reference.",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        await activityMiddleware(req, user.id, 'Service order deleted successfully', 'SERVICE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Service order deleted successfully.",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting service order', 'SERVICE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred.",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteServiceOrder };
