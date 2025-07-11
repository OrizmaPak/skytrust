const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const updateLogQty = async (req, res) => {
    const { id, qty, status } = req.body;

    // Validate the presence of id and either qty or status
    if (!id || (qty === undefined && !status)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "ID and either quantity or status are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["ID and either quantity or status are required"]
        });
    }

    try {
        // Check if the item exists in the inventory
        const { rows: itemExists } = await pg.query(`SELECT * FROM skyeu."Inventory" WHERE id = $1 AND status = 'ACTIVE'`, [id]);
        if (itemExists.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Item not found in the inventory",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Item not found in the inventory"]
            });
        }

        // Update the quantity of the item in the inventory if qty is provided
        if (qty !== undefined) {
            await pg.query(`UPDATE skyeu."Inventory" SET qty = $1 WHERE id = $2`, [-qty, id]);
            // Log activity for quantity update
            await activityMiddleware(req, req.user.id, `Quantity for item ID ${id} updated to ${qty}`, 'UPDATE_LOG_QTY');
        }

        // If status is sent and it's 'DELETED', update the status to 'DELETED'
        if (status === 'DELETED') {
            await pg.query(`UPDATE skyeu."Inventory" SET status = 'DELETED' WHERE id = $1`, [id]);
            // Log activity for status update
            await activityMiddleware(req, req.user.id, `Status for item ID ${id} updated to DELETED`, 'UPDATE_LOG_QTY');
        }

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Update successful",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, req.user.id, 'An unexpected error occurred updating quantity or status', 'UPDATE_LOG_QTY');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

module.exports = { updateLogQty };
