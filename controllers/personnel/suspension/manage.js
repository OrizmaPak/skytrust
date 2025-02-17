const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

const saveOrUpdateSuspension = async (req, res) => {
    if(req.files) await uploadToGoogleDrive(req, res);
    const user = req.user;
    const { id, userid, title, image, status } = req.body;

    try {
        let query;
        if (id) {
            // Update existing record
            query = {
                text: `UPDATE sky."suspension" 
                       SET userid = COALESCE($1, userid), 
                           title = COALESCE($2, title), 
                           image = COALESCE($3, image), 
                           createdby = COALESCE($4, createdby), 
                           status = COALESCE($5, status)
                       WHERE id = $6 RETURNING *`,
                values: [userid, title, image, user.id, status, id]
            };
        } else {
            // Insert new record
            query = {
                text: `INSERT INTO sky."suspension" (userid, title, image, createdby, status)
                       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                values: [userid, title, image, user.id, 'ACTIVE']
            };
        }

        const result = await pg.query(query);
        const suspension = result.rows[0];

        await activityMiddleware(req, user.id, 'Suspension saved or updated successfully', 'SUSPENSION');

        const updateUserRoleQuery = {
            text: `UPDATE sky."User" SET role = $1 WHERE id = $2`,
            values: ['MEMBER', userid]
        };

        await pg.query(updateUserRoleQuery);

        return res.status(StatusCodes.OK).json({
            status: true,
            message: id ? "Suspension updated successfully" : "Suspension saved successfully",
            statuscode: StatusCodes.OK,
            data: suspension,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving or updating suspension', 'SUSPENSION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { saveOrUpdateSuspension };
