const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deletePromotion = async (req, res) => {
    const user = req.user;
    const { id } = req.params;

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Promotion ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Missing required fields"]
        });
    }

    try {
        // Soft delete the promotion by setting its status to 'DELETED'
        const { rowCount } = await pg.query({
            text: `UPDATE skyeu."promotiondemotion" 
                   SET "status" = 'DELETED', "dateadded" = NOW() 
                   WHERE "id" = $1 AND "status" = 'ACTIVE'`,
            values: [id]
        });

        if (rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Promotion not found or already deleted",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Promotion not found or already deleted"]
            });
        }

        await activityMiddleware(req, user.id, 'Promotion deleted successfully', 'PROMOTION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Promotion deleted successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting promotion', 'PROMOTION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deletePromotion };
