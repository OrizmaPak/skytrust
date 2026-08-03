const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { hasPermission } = require("../../../utils/permissions");

async function manageroles(req, res) {
    const { id, role, permissions, description, status } = req.body;
    const user = req.user;

    if (!hasPermission(user, 'ACCESS CONTROL')) {
        return res.status(StatusCodes.FORBIDDEN).json({
            status: false,
            message: "You are not authorized to manage roles",
            statuscode: StatusCodes.FORBIDDEN,
            data: null,
            errors: []
        });
    }

    if (!role) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Role name is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    if (role.toLowerCase() === 'custom') {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Role name 'custom' is not allowed",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    if (role.toLowerCase() === 'superadmin') {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Role name 'superadmin' is not allowed",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }
   
    try {   
        if (role) {
            // Check if the role already exists
            const { rows: existingRoles } = await pg.query(`SELECT * FROM skytobi."Roles" WHERE role = $1`, [role]);
    
            if (existingRoles.length > 0) {
                // If the role exists, update it
                if (status && status !== 'ACTIVE') {
                    // If the status is not ACTIVE, update only the status
                    await pg.query(`UPDATE skytobi."Roles" SET status = $1 WHERE role = $2`, [status, role]);
                    await pg.query(`UPDATE skytobi."User" SET permissions = $1 WHERE role = $2`, [status, role]);
                    await activityMiddleware(req, user.id, `Role '${role}' status updated to '${status}' successfully`);
                } else if (status && status === 'ACTIVE') {
                    // If the status is ACTIVE, update permissions and description
                    await pg.query(`UPDATE skytobi."Roles" SET permissions = $1, description = $2, status = $3 WHERE role = $4`, [permissions, description, status, role]);
                    await pg.query(`UPDATE skytobi."User" SET permissions = $1 WHERE role = $2`, [permissions, role]);
                    await activityMiddleware(req, user.id, `Role '${role}' updated successfully with new permissions`);
                } else {
                    // If no status provided, update permissions and description
                    await pg.query(`UPDATE skytobi."Roles" SET permissions = $1, description = $2 WHERE role = $3`, [permissions, description, role]);
                    await pg.query(`UPDATE skytobi."User" SET permissions = $1 WHERE role = $2`, [permissions, role]);
                    await activityMiddleware(req, user.id, `Role '${role}' permissions updated successfully`);
                }
            } else {
                // If the role does not exist, create it
                await pg.query(`INSERT INTO skytobi."Roles" (role, permissions, description, status) VALUES ($1, $2, $3, $4)`, [role, permissions, description, status || 'ACTIVE']);
                await activityMiddleware(req, user.id, `Role '${role}' created successfully`);
            }
        }

        return res.status(StatusCodes.OK).json({
            status: true,
            message: id ? "Role updated successfully" : "Role processed successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}

module.exports = { manageroles };
