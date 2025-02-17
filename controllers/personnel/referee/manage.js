const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

const saveOrUpdateReferee = async (req, res) => {
    if (req.files) await uploadToGoogleDrive(req, res);
    const user = req.user;
    const {
        id,
        userid,
        refereename,
        refereeofficeaddress,
        refereeresidentialaddress,
        refereeoccupation,
        refereephone,
        refereeyearsknown,
        relationship,
        imageone,
        imagetwo
    } = req.body;

    if (!userid || !refereename || !refereeofficeaddress || !refereeresidentialaddress || !refereeoccupation || !refereephone || !refereeyearsknown || !relationship) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "All required fields must be provided",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Missing required fields"]
        });
    }

    try {
        // Check if the user exists
        const { rows: userRows } = await pg.query(
            `SELECT id FROM sky."User" WHERE id = $1 AND status = 'ACTIVE'`,
            [userid]
        );

        if (userRows.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "User not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["User ID does not exist"]
            });
        }

        let query;
        let message;

        if (id) {
            // Update existing referee
            query = {
                text: `UPDATE sky."referee" SET 
                        refereename = COALESCE($1, refereename),
                        refereeofficeaddress = COALESCE($2, refereeofficeaddress),
                        refereeresidentialaddress = COALESCE($3, refereeresidentialaddress),
                        refereeoccupation = COALESCE($4, refereeoccupation),
                        refereephone = COALESCE($5, refereephone),
                        refereeyearsknown = COALESCE($6, refereeyearsknown),
                        relationship = COALESCE($7, relationship),
                        imageone = COALESCE($8, imageone),
                        imagetwo = COALESCE($9, imagetwo),
                        userid = COALESCE($10, userid)
                       WHERE id = $11 AND status = 'ACTIVE'`,
                values: [refereename, refereeofficeaddress, refereeresidentialaddress, refereeoccupation, refereephone, refereeyearsknown, relationship, imageone, imagetwo, userid, id]
            };
            message = 'Referee updated successfully';
        } else {
            // Insert new referee
            query = {
                text: `INSERT INTO sky."referee" 
                        (userid, refereename, refereeofficeaddress, refereeresidentialaddress, refereeoccupation, refereephone, refereeyearsknown, relationship, imageone, imagetwo, createdby) 
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                values: [userid, refereename, refereeofficeaddress, refereeresidentialaddress, refereeoccupation, refereephone, refereeyearsknown, relationship, imageone, imagetwo, user.id]
            };
            message = 'Referee saved successfully';
        }

        await pg.query(query);

        await activityMiddleware(req, user.id, message, 'REFEREE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message,
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving/updating referee', 'REFEREE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { saveOrUpdateReferee };