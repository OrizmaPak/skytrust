const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteReferee = async (req, res) => {
    const user = req.user;
    const { id } = req.body;

    try {
        await pg.query('BEGIN');

        // Check if the referee exists
        const { rows: refereeRows } = await pg.query(
            `SELECT id FROM skyeu."referee" WHERE id = $1 AND status = 'ACTIVE'`,
            [id]
        );

        if (refereeRows.length === 0) {
            await pg.query('ROLLBACK');
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Referee not found or already deleted",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Referee ID does not exist"]
            });
        }

        // Update the status to DELETED
        await pg.query(
            `UPDATE skyeu."referee" SET status = 'DELETED' WHERE id = $1`,
            [id]
        );

        await pg.query('COMMIT');

        await activityMiddleware(req, user.id, 'Referee deleted successfully', 'REFEREE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Referee deleted successfully",
            statuscode: StatusCodes.OK,
            data: { id },
            errors: []
        });
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting referee', 'REFEREE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteReferee };
