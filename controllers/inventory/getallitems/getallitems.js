const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getAllUniqueItemIds = async (req, res) => {
    try {
        // Fetch all unique itemids and itemnames from the Inventory
        const { rows: items } = await pg.query(`SELECT DISTINCT itemid, itemname FROM skyeu."Inventory"`);

        // Extract unique itemids and itemnames
        const uniqueItems = items.map(item => ({ itemid: item.itemid, itemname: item.itemname }));

        // Log activity
        await activityMiddleware(res, req.user.id, 'Fetched all unique itemids and itemnames from inventory', 'GET ALL UNIQUE ITEMIDS');

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Unique itemids and itemnames fetched successfully",
            statuscode: StatusCodes.OK,
            data: uniqueItems,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(res, req.user.id, 'An unexpected error occurred while fetching unique itemids and itemnames', 'GET ALL UNIQUE ITEMIDS');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

module.exports = { getAllUniqueItemIds };
