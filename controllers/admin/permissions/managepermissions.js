const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { hasPermission } = require("../../../utils/permissions");

  
async function managepermissions(req, res) {

    const { id='', permissions='', role } = req.body;
    const user = req.user

    if (!hasPermission(user, 'ACCESS CONTROL')) {
        return res.status(StatusCodes.FORBIDDEN).json({
            status: false,
            message: "You are not authorized to update permissions",
            statuscode: StatusCodes.FORBIDDEN,
            data: null,
            errors: []
        });
    }

    if (!role || !id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Role or User not provided",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    // GET THE USERS
    const { rows: userDetails } = await pg.query(
        `SELECT id, firstname, lastname, othernames, role FROM skytobi."User" WHERE id = $1`,
        [id]
    );

    if (userDetails.length === 0) {
        return res.status(StatusCodes.NOT_FOUND).json({
            status: false,
            message: "User not found",
            statuscode: StatusCodes.NOT_FOUND,
            data: null,
            errors: []
        });
    }

    // CHECK IF THE USER TO BE UPDATED IS A SUPERADMIN
    if (userDetails[0].role === 'SUPERADMIN') {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "You cannot update the permissions of a superadmin. Contact developers for concerns.",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }
    // DECLARE THE USER OPERATED ON
    let userid;

    try{
        // Check if role is provided and exists in Roles table
            const { rows: existingRoles } = await pg.query(`SELECT * FROM skytobi."Roles" WHERE role = $1`, [role]);
            if (existingRoles.length > 0) {
                // If the role exists, fetch its permissions
                const rolePermissions = existingRoles[0].permissions;
                // Update the user with the role's permissions
                await pg.query(`UPDATE skytobi."User" 
                                 SET permissions = $1,
                                 role = $2
                                 WHERE id = $3`, [rolePermissions, role, id]);
            } else {
                // If the role does not exist, update the user with the provided permissions
                await pg.query(`UPDATE skytobi."User" 
                                SET permissions = $1,
                                role = $2
                                WHERE id = $3`, [permissions, role, id]);
            }
        
        
        // TRACK ACTIVITY
        if (userDetails.length > 0) {
            const { firstname, lastname, othernames } = userDetails[0];
            const fullName = `${firstname} ${lastname} ${othernames || ''}`.trim();
            await activityMiddleware(req, user.id, `Updated Permissions of ${fullName || id} with id of ${id} to ${role} role`, 'PERMISSIONS');
        }
        
        await activityMiddleware(req, user.id, `Updated Permissions of ${id}`, 'PERMISSIONS');
        
        // INFORM THE USER 
        return res.status(StatusCodes.OK).json({
            status: true,
            message: 'Permissions Update Successful',
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });

    } catch (err) {
        console.error('Unexpected Error:', err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}


module.exports = {managepermissions}
