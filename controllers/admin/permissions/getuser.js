const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

async function getuser(req, res) {
    try {
        const searchParams = new URLSearchParams(req.query);
        const id = parseInt(searchParams.get('id'));

        // CHECK IF ID is provide
        if(!id){
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "User not found",
                statuscode: StatusCodes.OK,
                data: 'user',
                errors: []
            });
        }
        const { rows: users } = await pg.query(
            `SELECT * FROM skytobi."User" WHERE status = $1 AND id = $2`,
            ['ACTIVE', id]
        );

        if(users.length > 0){
            const sanitizedUsers = users.map(({ password, ...user }) => user);
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Profile fetched successfully.",
                statuscode: StatusCodes.OK,
                data: sanitizedUsers,
                errors: []
            });
        }

        return res.status(StatusCodes.NOT_FOUND).json({
            status: false,
            message: "User not found",
            statuscode: StatusCodes.NOT_FOUND,
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

module.exports = { getuser }
