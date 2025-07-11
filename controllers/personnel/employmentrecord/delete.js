const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteEmploymentRecord = async (req, res) => {
    const user = req.user;
    const { id } = req.body;

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Employment record ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Missing employment record ID"]
        });
    }

    try {
        const { rowCount } = await pg.query(
            `UPDATE skyeu."employmentrecord" SET status = 'DELETED' WHERE id = $1 AND status = 'ACTIVE'`,
            [id]
        );

        if (rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Employment record not found or already deleted",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Employment record not found or already deleted"]
            });
        }

        await activityMiddleware(req, user.id, 'Employment record deleted successfully', 'EMPLOYMENT_RECORD');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Employment record deleted successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting employment record', 'EMPLOYMENT_RECORD');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteEmploymentRecord };
