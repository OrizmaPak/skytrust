const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteMonitoringEvaluation = async (req, res) => {
    const user = req.user;
    const { id } = req.body;

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Monitoring Evaluation ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Monitoring Evaluation ID is required"]
        });
    }

    try {
        const query = {
            text: `UPDATE sky."monitoringevaluation" SET status = 'DELETED' WHERE id = $1 RETURNING *`,
            values: [id]
        };

        const result = await pg.query(query);
        const monitoringEvaluation = result.rows[0];

        if (!monitoringEvaluation) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Monitoring Evaluation not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Monitoring Evaluation not found"]
            });
        }

        await activityMiddleware(req, user.id, 'Monitoring Evaluation deleted successfully', 'MONITORING_EVALUATION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Monitoring Evaluation deleted successfully",
            statuscode: StatusCodes.OK,
            data: monitoringEvaluation,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred deleting monitoring evaluation', 'MONITORING_EVALUATION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { deleteMonitoringEvaluation };
