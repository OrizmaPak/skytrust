// Import necessary modules
const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

// Define the harddeleteinventory function
const harddeleteinventory = async (req, res) => {
    // Destructure the request body to get the id
    const { id } = req.body;
    // return
    // Check if id is provided
    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["ID is required"]
        });
    }

    try {
        // Delete the inventory entry with the given id
        const result = await pg.query(`DELETE FROM skyeu."Inventory" WHERE id = $1 RETURNING *`, [id]);

        // Check if the entry was found and deleted
        if (result.rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Inventory entry not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Inventory entry not found"]
            });
        }

        // Log activity
        await activityMiddleware(res, req.user.id, `Inventory entry with id ${id} deleted successfully`, 'DELETE_INVENTORY');

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Inventory deleted successfully",
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

// Export the harddeleteinventory function
module.exports = { harddeleteinventory };
