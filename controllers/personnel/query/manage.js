const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

const manageQuery = async (req, res) => {
    if (req.files) await uploadToGoogleDrive(req, res);
    const user = req.user;
    const { id, userid, query, imageone } = req.body;

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
            // Update existing query
            const { rowCount } = await pg.query({
                text: `UPDATE skyeu."query" SET 
                        "userid" = COALESCE($1, "userid"),
                        "query" = COALESCE($2, "query"),
                        "imageone" = COALESCE($3, "imageone")
                    WHERE "id" = $4 AND "status" = 'ACTIVE'`,
                values: [userid, query, imageone, id]
            });

            if (rowCount === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Query not found or already deleted",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: ["Query not found or already deleted"]
                });
            }

            await activityMiddleware(req, user.id, 'Query updated successfully', 'QUERY');

            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Query updated successfully",
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            });
        } else {
            // Create new query
            const { rows } = await pg.query({
                text: `INSERT INTO skyeu."query" (
                        "userid",
                        "query",
                        "imageone",
                        "createdby"
                    ) VALUES ($1, $2, $3, $4) RETURNING "id"`,
                values: [userid, query, imageone, user.id]
            });

            const newId = rows[0].id;

            await activityMiddleware(req, user.id, 'Query created successfully', 'QUERY');

            return res.status(StatusCodes.CREATED).json({
                status: true,
                message: "Query created successfully",
                statuscode: StatusCodes.CREATED,
                data: { id: newId },
                errors: []
            });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred managing query', 'QUERY');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { manageQuery };