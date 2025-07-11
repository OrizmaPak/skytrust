const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteCategoryTimeline = async (req, res) => {
    const user = req.user;
    const { id, status = 'DELETED' } = req.body;

    try {

        if (!id) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "ID must be provided",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["ID is required to delete a category timeline"]
            });
        }

        let query;
        if (id) {
            // Update existing categorytimeline
            query = {
                text: `UPDATE skyeu."categorytimeline" 
                       SET status = $1
                       WHERE id = $2`,
                values: [status, id]
            };
        } 

        await pg.query(query);

        const action = id ? 'deleted' : 'saved';
        await activityMiddleware(req, user.id, `Category timeline ${action} successfully`, 'CATEGORY_TIMELINE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: `Category timeline ${action} successfully`,
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving category timeline', 'CATEGORY_TIMELINE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteCategoryTimeline };
