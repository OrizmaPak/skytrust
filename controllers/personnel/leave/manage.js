const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

const saveOrUpdateLeave = async (req, res) => {
    if(req.files) await uploadToGoogleDrive(req, res);
    const user = req.user;
    const { id, userid, title, startdate, enddate, image, status } = req.body;

    try {
        let query;
        if (id) {
            // Update existing record
            query = {
                text: `UPDATE sky."leave" 
                       SET userid = COALESCE($1, userid), 
                           title = COALESCE($2, title), 
                           startdate = COALESCE($3, startdate), 
                           enddate = COALESCE($4, enddate), 
                           image = COALESCE($5, image), 
                           createdby = COALESCE($6, createdby), 
                           status = COALESCE($7, status)
                       WHERE id = $8 RETURNING *`,
                values: [userid, title, startdate, enddate, image, user.id, status, id]
            };
        } else {
            // Insert new record
            query = {
                text: `INSERT INTO sky."leave" (userid, title, startdate, enddate, image, createdby, status)
                       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                values: [userid, title, startdate, enddate, image, user.id, 'ACTIVE']
            };
        }

        const result = await pg.query(query);
        const leave = result.rows[0];

        await activityMiddleware(req, user.id, 'Leave saved or updated successfully', 'LEAVE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Leave saved or updated successfully",
            statuscode: StatusCodes.OK,
            data: leave,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving or updating leave', 'LEAVE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { saveOrUpdateLeave };
