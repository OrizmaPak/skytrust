const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deletePurchaseOrder = async (req, res) => {
    const user = req.user;
    const { transactionref } = req.body;

    console.log('transactionref', transactionref)

    if (!transactionref) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Transaction reference is required"+transactionref,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Transaction reference is required"]
        });
    }

    try {
        // Update the status of all inventory items with the given transactionref to 'DELETED'
        const updateQuery = {
            text: `UPDATE skyeu."Inventory" SET status = 'DELETED' WHERE transactionref = $1`,
            values: [transactionref]
        };

        const result = await pg.query(updateQuery);

        if (result.rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "No inventory items found with the given transaction reference",
                statuscode: StatusCodes.NOT_FOUND, 
                data: null,
                errors: ["No inventory items found with the given transaction reference"]
            });
        }

        await activityMiddleware(req, user.id, 'Purchase order deleted successfully', 'PURCHASE ORDER');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Purchase order deleted successfully",
            statuscode: StatusCodes.OK,
            data: null, 
            errors: []
        }); 
    } catch (error) { 
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting purchase order', 'PURCHASE ORDER');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deletePurchaseOrder };
