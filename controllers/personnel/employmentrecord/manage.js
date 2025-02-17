const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

const saveOrUpdateEmploymentRecord = async (req, res) => {
    console.log('Starting transaction for saving or updating employment record');
    if (req.files) await uploadToGoogleDrive(req, res);
    const user = req.user;
    let { id, userid, employer, position, years, reasonofleaving, doc } = req.body;

    try {
        console.log('Starting transaction for saving or updating employment record');
        await pg.query('BEGIN');

        const requiredFields = { employer, position, years, reasonofleaving, userid };
        const missingFields = Object.entries(requiredFields).filter(([_, value]) => !value).map(([key]) => key);

        if (missingFields.length > 0) {
            console.log('Missing fields:', missingFields);
            await pg.query('ROLLBACK');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Please fill all the fields: ${missingFields.join(', ')}`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: [`Missing fields: ${missingFields.join(', ')}`]
            });
        }
 
        const { rows: userRows } = await pg.query(
            `SELECT id FROM sky."User" WHERE id = $1`,
            [userid]
        );

        if (userRows.length === 0) {
            console.log('Invalid User ID:', userid);
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
            console.log('Updating existing employment record with ID:', id);
            // Update existing employment record
            await pg.query(
                `UPDATE sky."employmentrecord" SET 
                    userid = COALESCE($1, userid), 
                    employer = COALESCE($2, employer), 
                    position = COALESCE($3, position), 
                    years = COALESCE($4, years), 
                    reasonofleaving = COALESCE($5, reasonofleaving), 
                    doc = COALESCE($6, doc), 
                    dateadded = NOW(), 
                    createdby = COALESCE($7, createdby), 
                    status = 'ACTIVE' 
                WHERE id = $8`,
                [userid, employer, position, years, reasonofleaving, doc, user.id, id]
            );
        } else {
            console.log('Inserting new employment record');
            // Insert new employment record
            const { rows } = await pg.query(
                `INSERT INTO sky."employmentrecord" (userid, employer, position, years, reasonofleaving, doc, dateadded, createdby, status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, 'ACTIVE') RETURNING id`,
                [userid, employer, position, years, reasonofleaving, doc, user.id]
            );
            id = rows[0].id;
            console.log('New employment record ID:', id);
        }

        await pg.query('COMMIT');
        console.log('Transaction committed successfully');

        await activityMiddleware(req, user.id, 'Employment record saved or updated successfully', 'EMPLOYMENT_RECORD');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: id ? "Employment record updated successfully" : "Employment record saved successfully",
            statuscode: StatusCodes.OK,
            data: { id },
            errors: []
        });
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving or updating employment record', 'EMPLOYMENT_RECORD');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { saveOrUpdateEmploymentRecord };