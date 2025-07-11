const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteRecipient = async (req, res) => {
    const user = req.user;
    const { id } = req.body;

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Recipient ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: [{ field: 'id', message: 'Recipient ID is required' }]
        });
    }

    try {
        const query = `
            UPDATE skyeu."reciepients"
            SET status = 'DELETED'
            WHERE id = $1
            RETURNING *
        `;
        const values = [id];

        const { rows: [recipientRecord] } = await pg.query(query, values);

        if (!recipientRecord) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Recipient not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        await activityMiddleware(req, user.id, 'Recipient deleted successfully', 'RECIPIENT');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Recipient deleted successfully",
            statuscode: StatusCodes.OK,
            data: recipientRecord,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred while deleting recipient', 'RECIPIENT');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteRecipient };
