const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware

const definepositionbymembership = async (req, res) => {
    const { id="", member, position, branch=0, status="", userid=null } = req.body;
    
    const user = req.user

    // Basic validation
    if ((!member && !id) || !position) {
        let errors = [];
        if (!member) {
            errors.push({
                field: 'Member Name',
                message: 'Member name not found' 
            }); 
        }
        if (!position) { 
            errors.push({
                field: 'Position Name',
                message: 'Position name not found' 
            }); 
        }

        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Missing Fields",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: errors
        });
    }

    try {
        if (!id) {
            // Check if member exists using raw query
            const { rows: themember } = await pg.query(`SELECT * FROM skyeu."DefineMember" WHERE id = $1`, [member]);

            if (themember.length == 0) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Membership cannot be found",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            // Check if position already exists for the member using raw query
            const { rows: thepositions } = await pg.query(`SELECT * FROM skyeu."Position" WHERE member = $1`, [member]);

            let positionAlreadyExists = false;
            for (const pos of thepositions) {
                if (pos.position === position) {
                    positionAlreadyExists = true;
                    break;
                }
            }
            if (positionAlreadyExists) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Position already exist for this member",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null, 
                    errors: []
                });
            }

            // Check if branch exists if branch is provided
            if (branch) {
                const { rows: thebranch } = await pg.query(`SELECT * FROM skyeu."Branch" WHERE id = $1`, [branch]);
                if (thebranch.length == 0) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: "Branch cannot be found",
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: []
                    });
                }
            }

            // Check if user exists if userid is provided
            if (userid) {
                const { rows: theuser } = await pg.query(`SELECT * FROM skyeu."User" WHERE id = $1`, [userid]);
                if (theuser.length == 0) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: "User cannot be found",
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: []
                    });
                }
            }
        }

        // DEFINE QUERY
        let query;

        if (id) {
            if (id && status) {
                query = await pg.query(`UPDATE skyeu."Position" SET 
                    status = COALESCE($1, status),
                    lastupdated = $2
                    WHERE id = $3`, [status, new Date(), id]);
            } else {
                query = await pg.query(`UPDATE skyeu."Position" SET 
                    member = COALESCE($1, member), 
                    position = COALESCE($2, position), 
                    branch = COALESCE($3, branch),
                    userid = COALESCE($4, userid),
                    lastupdated = $5
                    WHERE id = $6`, [member, position, branch, userid, new Date(), id]);
            }
        } else {
            query = await pg.query(`INSERT INTO skyeu."Position" 
                (member, position, branch, userid, createdby) 
                VALUES ($1, $2, $3, $4, $5)`, [member, position, branch, userid, user.id]);
        }

        // NOW SAVE THE POSITION
        const { rowCount: saveposition } = query

        // RECORD THE ACTIVITY
        await activityMiddleware(req, user.id, `${position} Position ${!id ? 'created' : 'updated'}`, 'POSITION');

        const responseData = {
            status: true,
            message: `${position} successfully ${!id ? 'created' : 'updated'}`,
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        };

        if (saveposition > 0) return res.status(StatusCodes.OK).json(responseData);
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

module.exports = {
    definepositionbymembership
};