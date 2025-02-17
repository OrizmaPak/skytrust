const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const { activityMiddleware } = require("../../../middleware/activity"); // Tracker middleware for activity tracking
const pg = require("../../../db/pg"); // Import PostgreSQL database connection

// Function to handle updating requisition
const editRequisition = async (req, res) => {
    // Parse 'rowsize' from string to integer
    const rowsize = parseInt(req.body.rowsize, 10);
    let report = [];

    // Input Validation for 'rowsize'
    if (isNaN(rowsize) || rowsize <= 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid 'rowsize' provided.",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["'rowsize' must be a positive integer."]
        });
    }

    try {
        await pg.query('BEGIN'); // Start transaction

        for (let i = 1; i <= rowsize; i++) {
            const itemid = req.body[`itemid${i}`];
            const reference = req.body[`reference${i}`];
            const status = req.body[`status${i}`];
            
            // Parse 'qty' and 'sellingprice' from strings to numbers
            const qty = parseFloat(req.body[`qty${i}`]);
            const sellingprice = parseFloat(req.body[`sellingprice${i}`]);

            // Validate each item's inputs
            const itemErrors = [];
            if (!itemid) itemErrors.push(`'itemid${i}' is missing.`);
            if (!reference) itemErrors.push(`'reference${i}' is missing.`);
            if (status !== 'DELETED' && isNaN(qty)) itemErrors.push(`'qty${i}' must be a valid number.`);
            if (status !== 'DELETED' && isNaN(sellingprice)) itemErrors.push(`'sellingprice${i}' must be a valid number.`);

            if (itemErrors.length > 0) {
                report.push({
                    item: i,
                    status: 'error',
                    messages: itemErrors
                });
                continue;
            }

            // Fetch inventory items with the given reference and itemid
            const { rows: inventoryItems } = await pg.query(`
                SELECT * FROM sky."Inventory" 
                WHERE reference = $1 AND itemid = $2
            `, [reference, itemid]);

            if (inventoryItems.length !== 2) {
                report.push({
                    item: i,
                    status: 'error',
                    messages: [`Invalid number of inventory items for item ${i}. Expected 2, found ${inventoryItems.length}.`]
                });
                continue;
            }

            const positiveQtyItem = inventoryItems.find(item => item.qty > 0);
            const negativeQtyItem = inventoryItems.find(item => item.qty < 0);

            if (!positiveQtyItem || !negativeQtyItem) {
                report.push({
                    item: i,
                    status: 'error',
                    messages: [`Inventory items must include one with positive qty and one with negative qty for item ${i}.`]
                });
                continue;
            }

            // Handle based on the status of the negativeQtyItem
            if (status === 'DELETED') {
                if (positiveQtyItem.status !== 'PENDING REQUISITION') {
                    report.push({
                        item: i,
                        status: 'error',
                        messages: [`Only items with status 'PENDING REQUISITION' can be deleted for item ${i}.`]
                    });
                    continue;
                }

                // Update the status of both items to 'DELETED'
                await pg.query(`
                    UPDATE sky."Inventory"
                    SET status = 'DELETED'
                    WHERE id = $1 OR id = $2
                `, [positiveQtyItem.id, negativeQtyItem.id]);

                report.push({
                    item: i,
                    status: 'success',
                    messages: [`Requisition deleted successfully for item ${i}.`]
                });
                continue;
            }

            switch (positiveQtyItem.status) {
                case 'ACTIVE':
                    report.push({
                        item: i,
                        status: 'error',
                        messages: [`An already approved requisition cannot be updated for item ${i}.`]
                    });
                    break; 

                case 'DECLINED':
                    // Update the status of the negativeQtyItem to 'DECLINED'
                    await pg.query(`
                        UPDATE sky."Inventory"
                        SET status = 'DECLINED'
                        WHERE id = $1
                    `, [negativeQtyItem.id]);

                    report.push({
                        item: i,
                        status: 'warning',
                        messages: [`The destination has declined item ${i}.`]
                    });
                    break;

                case 'PENDING REQUISITION':
                    // Update positiveQtyItem
                    await pg.query(`
                        UPDATE sky."Inventory"
                        SET sellingprice = $1, qty = $2
                        WHERE id = $3
                    `, [sellingprice, qty, positiveQtyItem.id]);

                    // Update negativeQtyItem
                    await pg.query(`
                        UPDATE sky."Inventory"
                        SET sellingprice = $1, qty = $2
                        WHERE id = $3
                    `, [sellingprice, -qty, negativeQtyItem.id]);

                    report.push({
                        item: i,
                        status: 'success',
                        messages: [`Requisition updated successfully for item ${i}.`]
                    });
                    break;

                default:
                    report.push({
                        item: i,
                        status: 'error',
                        messages: [`Unknown status '${negativeQtyItem.status}' for item ${i}.`]
                    });
            }
        }

        await pg.query('COMMIT'); // Commit transaction

        // Separate successes and errors/warnings
        const successfulItems = report.filter(r => r.status === 'success');
        const problematicItems = report.filter(r => r.status !== 'success');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Requisition processing completed.",
            statuscode: StatusCodes.OK,
            data: {
                totalItems: rowsize,
                successful: successfulItems.length,
                problematic: problematicItems.length,
                details: report
            },
            errors: problematicItems.map(r => ({
                item: r.item,
                status: r.status,
                messages: r.messages
            }))
        });
    } catch (err) {
        await pg.query('ROLLBACK'); // Rollback transaction on error
        console.error('Unexpected Error:', err);

        // Log the error activity
        if (req.user && req.user.id) {
            await activityMiddleware(req, req.user.id, 'An unexpected error occurred updating requisition', 'INVENTORY');
        } else {
            // Handle cases where req.user might not be defined
            await activityMiddleware(req, null, 'An unexpected error occurred updating requisition', 'INVENTORY');
        }

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred.",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: ["Internal server error."]
        });
    }
}

module.exports = {
    editRequisition
};
