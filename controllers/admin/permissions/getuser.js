const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcrypt");
const { isValidEmail } = require("../../../utils/isValidEmail");
const pg = require("../../../db/pg");
const jwt = require("jsonwebtoken");
const { calculateExpiryDate } = require("../../../utils/expiredate");
const { sendEmail } = require("../../../utils/sendEmail");
const { authMiddleware } = require("../../../middleware/authentication");

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
        // CHECK IF USER IS AUTHENTICATED
        const {rows: users} = pg.query(`SELECT * FROM skyeu."User" WHERE status = ACTIVE AND id = $1`, [id])
        console.log(users)
        if(users.length > 0){
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Profile fetched successfully.",
                statuscode: StatusCodes.OK,
                data: users,
                errors: []
            });
        }
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