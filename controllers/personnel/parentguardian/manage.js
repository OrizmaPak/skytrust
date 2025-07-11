const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

const manageParentGuardian = async (req, res) => {
    if (req.files) await uploadToGoogleDrive(req, res);
    const user = req.user;
    const {
        id,
        userid,
        parentonename,
        parentoneoccupation,
        parentonestate,
        parentoneofficeaddress,
        parentonephone,
        parenttwoname,
        parenttwooccupation,
        parenttwoofficeaddress,
        parenttwostate,
        parenttwophone,
        parentoneimage,
        parenttwoimage,
        homeaddress
    } = req.body;

    if (!userid) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "User ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Missing user ID"]
        });
    }

    // Check if the user exists in the User table
    const { rowCount: userExists } = await pg.query({
        text: `SELECT 1 FROM skyeu."User" WHERE "id" = $1`,
        values: [userid]
    });

    if (userExists === 0) {
        return res.status(StatusCodes.NOT_FOUND).json({
            status: false,
            message: "User not found",
            statuscode: StatusCodes.NOT_FOUND,
            data: null,
            errors: ["User not found"]
        });
    }

    try {
        if (id) {
            // Update existing parentguardian
            const { rowCount } = await pg.query({
                text: `UPDATE skyeu."parentguardians" SET 
                        "userid" = COALESCE($1, "userid"),
                        "parentonename" = COALESCE($2, "parentonename"),
                        "parentoneoccupation" = COALESCE($3, "parentoneoccupation"),
                        "parentonestate" = COALESCE($4, "parentonestate"),
                        "parentoneofficeaddress" = COALESCE($5, "parentoneofficeaddress"),
                        "parentonephone" = COALESCE($6, "parentonephone"),
                        "parenttwoname" = COALESCE($7, "parenttwoname"),
                        "parenttwooccupation" = COALESCE($8, "parenttwooccupation"),
                        "parenttwoofficeaddress" = COALESCE($9, "parenttwoofficeaddress"),
                        "parenttwostate" = COALESCE($10, "parenttwostate"),
                        "parenttwophone" = COALESCE($11, "parenttwophone"),
                        "parentoneimage" = COALESCE($12, "parentoneimage"),
                        "parenttwoimage" = COALESCE($13, "parenttwoimage"),
                        "homeaddress" = COALESCE($14, "homeaddress")
                    WHERE "id" = $15 AND "status" = 'ACTIVE'`,
                values: [
                    userid,
                    parentonename,
                    parentoneoccupation,
                    parentonestate,
                    parentoneofficeaddress,
                    parentonephone,
                    parenttwoname,
                    parenttwooccupation,
                    parenttwoofficeaddress,
                    parenttwostate,
                    parenttwophone,
                    parentoneimage,
                    parenttwoimage,
                    homeaddress,
                    id
                ]
            });

            if (rowCount === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Parent/Guardian not found or already deleted",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: ["Parent/Guardian not found or already deleted"]
                });
            }

            await activityMiddleware(req, user.id, 'Parent/Guardian updated successfully', 'PARENT_GUARDIAN');

            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Parent/Guardian updated successfully",
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            });
        } else {
            // Create new parentguardian
            const { rows } = await pg.query({
                text: `INSERT INTO skyeu."parentguardians" (
                        "userid",
                        "parentonename",
                        "parentoneoccupation",
                        "parentonestate",
                        "parentoneofficeaddress",
                        "parentonephone",
                        "parenttwoname",
                        "parenttwooccupation",
                        "parenttwoofficeaddress",
                        "parenttwostate",
                        "parenttwophone",
                        "parentoneimage",
                        "parenttwoimage",
                        "homeaddress",
                        "createdby"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING "id"`,
                values: [
                    userid,
                    parentonename,
                    parentoneoccupation,
                    parentonestate,
                    parentoneofficeaddress,
                    parentonephone,
                    parenttwoname,
                    parenttwooccupation,
                    parenttwoofficeaddress,
                    parenttwostate,
                    parenttwophone,
                    parentoneimage,
                    parenttwoimage,
                    homeaddress,
                    user.id
                ]
            });

            const newId = rows[0].id;

            await activityMiddleware(req, user.id, 'Parent/Guardian created successfully', 'PARENT_GUARDIAN');

            return res.status(StatusCodes.CREATED).json({
                status: true,
                message: "Parent/Guardian created successfully",
                statuscode: StatusCodes.CREATED,
                data: { id: newId },
                errors: []
            });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred managing parent/guardian', 'PARENT_GUARDIAN');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { manageParentGuardian };