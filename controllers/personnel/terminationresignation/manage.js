const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

const saveOrUpdateTerminationResignation = async (req, res) => {
    if(req.files) await uploadToGoogleDrive(req, res);
    const user = req.user;
    const { id, userid, title, type, image, status } = req.body;

    try {
        let query;
        if (id) {
            // Update existing record
            query = {
                text: `UPDATE skyeu."terminationresignation" 
                       SET userid = COALESCE($1, userid), 
                           title = COALESCE($2, title), 
                           type = COALESCE($3, type), 
                           image = COALESCE($4, image), 
                           createdby = COALESCE($5, createdby), 
                           status = COALESCE($6, status)
                       WHERE id = $7 RETURNING *`,
                values: [userid, title, type, image, user.id, status, id]
            };
        } else {
            // Insert new record
            query = {
                text: `INSERT INTO skyeu."terminationresignation" (userid, title, type, image, createdby, status)
                       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                values: [userid, title, type, image, user.id, 'ACTIVE']
            };
        }

        const result = await pg.query(query);
        const terminationResignation = result.rows[0];

        const updateUserRoleQuery = {
            text: `UPDATE skyeu."User" SET role = $1 WHERE id = $2`,
            values: ['MEMBER', userid]
        };

        await pg.query(updateUserRoleQuery);

        await activityMiddleware(req, user.id, 'Termination/Resignation saved or updated successfully', 'TERMINATION_RESIGNATION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Termination/Resignation saved or updated successfully",
            statuscode: StatusCodes.OK,
            data: terminationResignation,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving or updating termination/resignation', 'TERMINATION_RESIGNATION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { saveOrUpdateTerminationResignation };