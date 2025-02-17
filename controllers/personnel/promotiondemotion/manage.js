const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const saveOrUpdatePromotion = async (req, res) => {
    const user = req.user;
    const { id, userid, title, level, type } = req.body;

    if (!userid || !title || !level || !type) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "User ID, Title, Level, and Type are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Missing required fields"]
        });
    }

    if (type !== type && type !== 'DEMOTION') {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Type must be either PROMOTION or DEMOTION",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Invalid type"]
        });
    }

    try {
        // Check if the level exists in the level table
        const { rowCount: levelCount } = await pg.query({
            text: `SELECT * FROM sky."level" WHERE "id" = $1`,
            values: [level]
        });

        if (levelCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Level not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Level not found"]
            });
        }
    } catch (error) {
        console.error('Error checking level:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An error occurred while checking the level",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }

    try {
        if (id) {
            // Update existing promotion
            const { rowCount } = await pg.query({
                text: `UPDATE sky."promotiondemotion" 
                       SET "userid" = COALESCE($1, "userid"), 
                           "title" = COALESCE($2, "title"), 
                           "level" = COALESCE($3, "level"), 
                           "type" = COALESCE($4, "type"), 
                           "dateadded" = NOW(), 
                           "createdby" = COALESCE($5, "createdby") 
                       WHERE "id" = $6 AND "status" = 'ACTIVE'`,
                values: [userid, title, level, type, user.id, id]
            });

            if (rowCount === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Promotion not found or already deleted",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: ["Promotion not found or already deleted"]
                });
            }

            // Update the level for the given userid
            const { rowCount: levelUpdateCount } = await pg.query({
                text: `UPDATE sky."promotiondemotion" 
                    SET "level" = $1 
                    WHERE "userid" = $2 AND "status" = 'ACTIVE'`,
                values: [level, userid]
            });

            if (levelUpdateCount === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "User not found or already deleted",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: ["User not found or already deleted"]
                });
            }

            await activityMiddleware(req, user.id, type+' updated successfully', type);

            // return res.status(StatusCodes.OK).json({
            //     status: true,
            //     message: "Promotion updated successfully",
            //     statuscode: StatusCodes.OK,
            //     data: null,
            //     errors: []
            // });
        } else {
            // Save new promotion
            await pg.query({
                text: `INSERT INTO sky."promotiondemotion" ("userid", "title", "level", "type", "dateadded", "createdby", "status") 
                       VALUES ($1, $2, $3, $4, NOW(), $5, 'ACTIVE')`,
                values: [userid, title, level, type, user.id]
            });

            await activityMiddleware(req, user.id, type+' saved successfully', type);

            // Update the level for the given userid
            const { rowCount: levelUpdateCount } = await pg.query({
                text: `UPDATE sky."promotiondemotion" 
                    SET "level" = $1 
                    WHERE "userid" = $2 AND "status" = 'ACTIVE'`,
                values: [level, userid]
            });

            if (levelUpdateCount === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "User not found or already deleted",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: ["User not found or already deleted"]
                });
            }
            
            // return res.status(StatusCodes.CREATED).json({
            //     status: true,
            //     message: type+" saved successfully",
            //     statuscode: StatusCodes.CREATED,
            //     data: null,
            //     errors: []
            // });
        }

        // Update the user's level in the user table
        const { rowCount: userLevelUpdateCount } = await pg.query({
            text: `UPDATE sky."User" 
                   SET "level" = $1 
                   WHERE "id" = $2 AND "status" = 'ACTIVE'`,
            values: [level, userid]
        });

        if (userLevelUpdateCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "User not found or already deleted",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["User not found or already deleted"]
            });
        }

        await activityMiddleware(req, user.id, 'User level updated successfully', type);

        return res.status(StatusCodes.OK).json({
            status: true,
            message: type+" successful",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving or updating promotion', type);

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { saveOrUpdatePromotion };