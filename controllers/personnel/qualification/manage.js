const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

const saveOrUpdateQualification = async (req, res) => {
    if (req.files) await uploadToGoogleDrive(req, res);
    const user = req.user;
    const { id, userid, institution, certificationdate, imageone, imagetwo, qualification } = req.body;

    try {
        await pg.query('BEGIN');
        const { rows: userRows } = await pg.query(
            `SELECT id FROM skyeu."User" WHERE id = $1`,
            [userid]
        );

        if (userRows.length === 0) {
            await pg.query('ROLLBACK');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "User ID does not exist",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Invalid User ID"]
            });
        }

        if (id) {
            // Update existing qualification using COALESCE
            const { rowCount } = await pg.query(
                `UPDATE skyeu."qualification" 
                 SET userid = COALESCE($1, userid), 
                     institution = COALESCE($2, institution), 
                     certificationdate = COALESCE($3, certificationdate), 
                     imageone = COALESCE($4, imageone), 
                     imagetwo = COALESCE($5, imagetwo), 
                     qualification = COALESCE($6, qualification), 
                     createdby = COALESCE($7, createdby)
                 WHERE id = $8 AND status = 'ACTIVE'`,
                [userid, institution, certificationdate, imageone, imagetwo, qualification, user.id, id]
            );

            if (rowCount === 0) {
                await pg.query('ROLLBACK');
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Qualification not found or already deleted",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: ["Qualification ID does not exist"]
                });
            }

            await activityMiddleware(req, user.id, 'Qualification updated successfully', 'QUALIFICATION');
        } else {
            // Insert new qualification
            await pg.query(
                `INSERT INTO skyeu."qualification" (userid, institution, certificationdate, imageone, imagetwo, qualification, createdby)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [userid, institution, certificationdate, imageone, imagetwo, qualification, user.id]
            );

            await activityMiddleware(req, user.id, 'Qualification saved successfully', 'QUALIFICATION');
        }

        await pg.query('COMMIT');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: id ? "Qualification updated successfully" : "Qualification saved successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving/updating qualification', 'QUALIFICATION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { saveOrUpdateQualification };