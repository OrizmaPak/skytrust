const { StatusCodes } = require("http-status-codes");
const { activityMiddleware } = require("../../../middleware/activity");
const pg = require("../../../db/pg");

const manageIssueType = async (req, res) => {
    const user = req.user;
    const { id, issuetype, status = "ACTIVE" } = req.body;

    if (!issuetype && !status) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Missing compulsory issuetype",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    } 

    try {
        if (!id) {
            const existingIssueType = await pg.query(`SELECT * FROM skyeu."issue" WHERE issuetype = $1`, [issuetype]);
            if (existingIssueType.rows.length > 0) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Issue type already exists",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            await pg.query(`INSERT INTO skyeu."issue" (issuetype, createdby, dateadded) VALUES ($1, $2, $3)`, [issuetype, user.id, new Date()]);
            await activityMiddleware(req, user.id, 'Issue type created successfully', 'ISSUE');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Issue type created successfully",
                statuscode: StatusCodes.OK,
                data: null, 
                errors: []
            });
        } else {
            if (status === "DELETED") {
                const { rows: inventoryItems } = await pg.query(`SELECT * FROM skyeu."Inventory" WHERE issuetype = $1`, [id]);
                if (inventoryItems.length > 0) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: "Cannot delete issue type as it is associated with existing inventory items",
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: []
                    });
                }
            }

            await pg.query(
                `UPDATE skyeu."issue" SET issuetype = COALESCE($1, issuetype), status = COALESCE($2, status) WHERE id = $3`,
                [issuetype, status, id]
            );
            await activityMiddleware(req, user.id, 'Issue type updated successfully', 'ISSUE');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Issue type updated successfully",
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        await activityMiddleware(req, user.id, 'An unexpected error occurred managing issue type', 'ISSUE');
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
    manageIssueType
};