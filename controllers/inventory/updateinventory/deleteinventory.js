// Import necessary modules
const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

// Define the deleteinventory function
const deleteinventory = async (req, res) => {
    // Destructure the request body to get itemid, branch, and department
    const { itemid, branch, department } = req.body;

    // Check if itemid, branch, and department are provided
    if (!itemid || !branch || !department) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Itemid, branch, and department are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Itemid, branch, and department are required"]
        });
    }

    try {
        // Split the concatenated itemid string
        const itemids = itemid && itemid.includes('||') ? itemid.split('||') : [itemid];

        // Update the status of inventory entries with the given itemids, branch, and department
        const result = await pg.query(
            `UPDATE skyeu."Inventory" 
             SET status = 'DELETED' 
             WHERE itemid = ANY($1) AND branch = $2 AND department = $3 RETURNING *`,
            [itemids, branch, department]
        );

        // Check if any entries were found and updated
        if (result.rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "No matching inventory entries found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["No matching inventory entries found"]
            });
        }

        // Log activity
        await activityMiddleware(res, req.user.id, `Inventory entries with itemids ${itemids.join(', ')} updated to DELETED`, 'DELETE_INVENTORY');

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Inventories DELETED successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        // Log and return error response
        console.error(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

// Export the deleteinventory function
module.exports = { deleteinventory };
