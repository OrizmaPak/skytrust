const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteParentGuardian = async (req, res) => {
    const user = req.user;
    const { id } = req.params;

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Parent/Guardian ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Missing Parent/Guardian ID"]
        });
    }

    try {
        const { rowCount } = await pg.query({
            text: `UPDATE skyeu."parentguardians" SET "status" = 'DELETED' WHERE "id" = $1 AND "status" = 'ACTIVE'`,
            values: [id]
        });

        if (rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Parent/Guardian not found or already deleted",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Parent/Guardian not found or already deleted"]
            });
        }

        await activityMiddleware(req, user.id, 'Parent/Guardian deleted successfully', 'PARENT_GUARDIAN');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Parent/Guardian deleted successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting parent/guardian', 'PARENT_GUARDIAN');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteParentGuardian };
