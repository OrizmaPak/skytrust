const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteGuarantor = async (req, res) => {
    const user = req.user;
    const { id } = req.body;

    try {
        await pg.query('BEGIN');

        // Check if the guarantor exists
        const { rows: guarantorRows } = await pg.query(
            `SELECT id FROM sky."guarantor" WHERE id = $1`,
            [id]
        );

        if (guarantorRows.length === 0) {
            await pg.query('ROLLBACK');
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Guarantor not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Guarantor ID does not exist"]
            });
        }

        // Update the status to DELETED
        await pg.query(
            `UPDATE sky."guarantor" SET status = 'DELETED' WHERE id = $1`,
            [id]
        );

        await pg.query('COMMIT');

        await activityMiddleware(req, user.id, 'Guarantor deleted successfully', 'GUARANTOR');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Guarantor deleted successfully",
            statuscode: StatusCodes.OK,
            data: { id },
            errors: []
        });
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting guarantor', 'GUARANTOR');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteGuarantor };
