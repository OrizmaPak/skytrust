const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const saveOrUpdatePropertyProduct = async (req, res) => {
    const user = req.user;
    const { id, product, member, useraccount, registrationcharge, productofficer, currency, description } = req.body;

    try {
        // Validate input
        if (!product) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Product is required",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Product is required"]
            });
        }

        // Validate member IDs if provided
        if (member) {
            const memberIds = member.includes('||') ? member.split('||') : [member];
            for (const memberId of memberIds) {
                const trimmedMemberId = memberId.trim();
                if (trimmedMemberId) {
                    const { rows } = await pg.query({
                        text: `SELECT 1 FROM skyeu."DefineMember" WHERE id = $1`,
                        values: [trimmedMemberId]
                    });
                    if (rows.length === 0) {
                        return res.status(StatusCodes.BAD_REQUEST).json({
                            status: false,
                            message: `Member ID ${trimmedMemberId} does not exist`,
                            statuscode: StatusCodes.BAD_REQUEST,
                            data: null,
                            errors: [`Member ID ${trimmedMemberId} does not exist`]
                        });
                    }
                }
            }
        }

        // Check if productofficer is provided and validate user role
        if (productofficer) {
            const { rows: userRoleRows } = await pg.query({
                text: `SELECT role FROM skyeu."User" WHERE id = $1`,
                values: [user.id]
            });

            if (userRoleRows.length > 0 && userRoleRows[0].role == 'MEMBER') {
                return res.status(StatusCodes.FORBIDDEN).json({
                    status: false,
                    message: "Members are not allowed to assign a product officer",
                    statuscode: StatusCodes.FORBIDDEN,
                    data: null,
                    errors: ["Members are not allowed to assign a product officer"]
                });
            }
        }

        if (id) {
            // Update existing property product
            const updateQuery = {
                text: `UPDATE skyeu."propertyproduct" 
                       SET product = $1, member = $2, useraccount = $3, registrationcharge = $4, productofficer = $5, currency = $6, description = $7, status = 'ACTIVE'
                       WHERE id = $8`,
                values: [product, member, useraccount || 1, registrationcharge, productofficer, currency || "USD", description, id]
            };

            await pg.query(updateQuery);

            await activityMiddleware(req, user.id, 'Property product updated successfully', 'PROPERTY_PRODUCT');

            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Property product updated successfully",
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            });
        } else {
            // Insert new property product
            const insertQuery = {
                text: `INSERT INTO skyeu."propertyproduct" (product, member, useraccount, registrationcharge, createdby, productofficer, currency, description, dateadded, status) 
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'ACTIVE')`,
                values: [product, member, useraccount || 1, registrationcharge, user.id, productofficer, currency || "USD", description]
            };

            await pg.query(insertQuery);

            await activityMiddleware(req, user.id, 'Property product saved successfully', 'PROPERTY_PRODUCT');

            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Property product saved successfully",
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            });
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving or updating property product', 'PROPERTY_PRODUCT');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { saveOrUpdatePropertyProduct };
