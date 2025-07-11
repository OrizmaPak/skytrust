const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const manageMembership = async (req, res) => {
    const { id = "", member, userid, status="ACTIVE" } = req.body;
    const user = req.user;

    // Basic validation
    if (!member || !userid) {
        let errors = [];
        if (!member) {
            errors.push({
                field: 'Member',
                message: 'Member ID is required'
            });
        }
        if (!userid) {
            errors.push({
                field: 'User ID', 
                message: 'User ID is required'
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
        // Check if user exists
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

        // Check if member exists
        const { rows: themember } = await pg.query(`SELECT * FROM skyeu."DefineMember" WHERE id = $1`, [member]);
        if (themember.length == 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Member cannot be found",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Check if the user already belongs to the member
        const { rows: existingMembership } = await pg.query(
            `SELECT * FROM skyeu."Membership" WHERE member = $1 AND userid = $2`,
            [member, userid]
        );

        if (!id && existingMembership.length > 0) {
            return res.status(StatusCodes.CONFLICT).json({
                status: false,
                message: "User already belongs to the membership",
                statuscode: StatusCodes.CONFLICT,
                data: null,
                errors: []
            });
        } 

        // DEFINE QUERY
        let query;

        if (id) {
            query = await pg.query(`UPDATE skyeu."Membership" SET 
                member = COALESCE($1, member), 
                userid = COALESCE($2, userid), 
                status = COALESCE($3, status),
                lastupdated = COALESCE($4, lastupdated)
                WHERE id = $5`, [member, userid, status, new Date(), id]);
        } else {
            query = await pg.query(`INSERT INTO skyeu."Membership" 
                (member, userid, status, createdby) 
                VALUES ($1, $2, $3, $4)`, [member, userid, status, user.id]);
        }

        // NOW SAVE THE MEMBERSHIP
        const { rowCount: savemembership } = query;

        // RECORD THE ACTIVITY
        await activityMiddleware(req, user.id, `Membership ${!id ? 'created' : 'updated'}`, 'MEMBERSHIP');

        const responseData = {
            status: true,
            message: `Membership successfully ${!id ? 'created' : 'updated'}`,
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        };

        if (savemembership > 0) return res.status(StatusCodes.OK).json(responseData);
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
};

module.exports = {
    manageMembership
};
