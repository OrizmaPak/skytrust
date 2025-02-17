const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware for activity tracking
const pg = require("../../../db/pg"); // Import PostgreSQL database connection

// Function to handle UPDATE inventory request
const updateRequisitionStatus = async (req, res) => {

    const user = req.user;

    // Extract rowsize and dynamic itemid, reference, status from request body
    const { rowsize, ...items } = req.body;

    // Validate input
    if (!rowsize || rowsize <= 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid rowsize",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        for (let i = 1; i <= rowsize; i++) {
            const itemid = items[`itemid${i}`];
            const reference = items[`reference${i}`];
            const status = items[`status${i}`];


            if (!status || !itemid || !reference || (status !== 'ACTIVE' && status !== 'DECLINED')) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Invalid status, missing itemid or reference for row ${i}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            // Determine the new status
            const newStatus = status === 'APPROVED' ? 'ACTIVE' : status;

            // Fetch inventories with the given itemid and reference
            const { rows: inventories } = await pg.query(
                `SELECT * FROM sky."Inventory" WHERE itemid = $1 AND reference = $2`,
                [itemid, reference]
            );

            // Ensure exactly two inventories are fetched
            if (inventories.length !== 2) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Expected exactly two inventory records for the given itemid and reference for row ${i}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            // Check if both inventories have the status 'PENDING REQUISITION'
            const pendingRequisitionInventories = inventories.filter(inv => inv.status === 'PENDING REQUISITION');
            if (pendingRequisitionInventories.length !== 2) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Both inventory records must have status 'PENDING REQUISITION' for the given itemid and reference for row ${i}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            // Update the status of both pending requisition inventories
            await Promise.all(pendingRequisitionInventories.map(inv => 
                pg.query(
                    `UPDATE sky."Inventory" SET status = $1 WHERE id = $2`,
                    [newStatus, inv.id]
                )
            ));
        }

        // Log activity
        await activityMiddleware(req, user.id, 'Requisition statuses updated successfully', 'INVENTORY'); // Tracker middleware

        // Respond with success
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Requisition operation completed successfully",
            statuscode: StatusCodes.OK, 
            data: null,
            errors: []
        });

    } catch (err) {
        console.error('Unexpected Error:', err);
        await activityMiddleware(req, user.id, 'An unexpected error occurred updating requisition statuses', 'INVENTORY'); // Tracker middleware
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}

module.exports = {
    updateRequisitionStatus
};
 