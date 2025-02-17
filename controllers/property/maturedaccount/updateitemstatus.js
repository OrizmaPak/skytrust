const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

/**
 * PUT /property/maturedaccount/updateitemstatus
 * Body: { id: number, key: string, value: any }
 * 
 * Updates a specific key in the propertyitems table for a given id.
 * If the key is 'deliveryrequested', also updates 'deliveryrequestdate' to the current timestamp.
 */
const updateItemStatus = async (req, res) => {
    const { id, key, value } = req.body;
    const user = req.user || {};

    // Validate input
    if (!id || !key) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid request. 'id' and 'key' are required.",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        // Construct the dynamic query
        let query;
        if (key === 'deliveryrequested') {
            query = {
                text: `UPDATE sky."propertyitems" SET "${key}" = $1, "deliveryrequestdate" = NOW() WHERE id = $2 RETURNING *`,
                values: [value, id]
            };
        } else {
            query = {
                text: `UPDATE sky."propertyitems" SET "${key}" = $1 WHERE id = $2 RETURNING *`,
                values: [value, id]
            };
        }

        const { rows } = await pg.query(query);

        // If no rows were updated, the id was not found
        if (rows.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: `No property item found with id: ${id}`,
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        // Log activity
        await activityMiddleware(req, user.id, `Updated property item with id: ${id}`, "PROPERTY_ITEM_UPDATE");

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Property item updated successfully",
            statuscode: StatusCodes.OK,
            data: rows[0],
            errors: []
        });
    } catch (error) {
        console.error("Unexpected Error:", error);
        await activityMiddleware(req, user.id || null, "An unexpected error occurred updating property item", "PROPERTY_ITEM_UPDATE");

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { updateItemStatus };

