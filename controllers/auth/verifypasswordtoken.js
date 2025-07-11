const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcrypt");
const { isValidEmail } = require("../../utils/isValidEmail");
const pg = require("../../db/pg");
const jwt = require("jsonwebtoken");
const { calculateExpiryDate } = require("../../utils/expiredate");
const { sendEmail } = require("../../utils/sendEmail");
const { activityMiddleware } = require("../../middleware/activity"); // Added tracker middleware

async function verifypasswordtoken(req, res) {
    const {token} = req.query;
    console.log({token});

    // Basic validation
    if (!token) {
        let errors = [];
        if (!token) {
            errors.push({
                field: '',
                message: 'Token not found'
            });
        }

        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Token not found",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: errors
        });
    }

   
    try {

            // CHECK IF ITS IN THE TOKEN TABLE
            const {rows:[user]} = await pg.query(`SELECT * FROM skyeu."VerificationToken" WHERE token = $1`, [token] )

            if(user && user.token == token && user.expires > new Date()){
                // WE WILL ONLY DELETE WHEN THE USER WANTS TO CHANGE PASSWORD
                // await pg.query(`DELETE FROM skyeu."VerificationToken" WHERE token = $1`, [token])
                const responseData = {
                    status: true,
                    message: `Token verified`,
                    statuscode: StatusCodes.OK,
                    data: null,
                    errors: []
                };
    
                // TRACK THE ACTIVITY
                await activityMiddleware(req, user.id, 'Token Verified for password change', 'AUTH');
                
                return res.status(StatusCodes.OK).json(responseData);
            }else{
                // TRACK THE ACTIVITY
                await activityMiddleware(req, user.id, 'Token invalid or expired for password change', 'AUTH');
                const responseData = {
                    status: false,
                    message: `Invalid/Expired Token`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                };
    
                return res.status(StatusCodes.BAD_REQUEST).json(responseData);
            }

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

module.exports = { verifypasswordtoken }