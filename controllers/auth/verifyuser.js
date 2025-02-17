const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcrypt");
const { isValidEmail } = require("../../utils/isValidEmail");
const pg = require("../../db/pg");
const jwt = require("jsonwebtoken");
const { calculateExpiryDate } = require("../../utils/expiredate");
const { sendEmail } = require("../../utils/sendEmail");
const { activityMiddleware } = require("../../middleware/activity"); // Added tracker middleware

async function verifyuser(req, res) {
    const { token } = req.body;
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
            error: true,
            message: "Missing Fields",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: errors
        });
    }

    try {
        // TRACKER: START
        await activityMiddleware(req, null, 'Verify User Attempt', 'AUTH');

        // CHECK IF ITS IN THE TOKEN TABLE
        const {rows:[user]} = await pg.query(`SELECT * FROM sky."VerificationToken" WHERE token = $1`, [token] )
        console.log(user)
        if(user && user.token == token && user.expires > new Date()){
            await pg.query(`DELETE FROM sky."VerificationToken" WHERE token = $1`, [token])
            await pg.query(`UPDATE sky."User" SET emailverified = $1 WHERE id = $2`, [new Date(), user.id])
            const responseData = {
                error: false,
                message: `Email verified`,
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            };
        
            // TRACK THE ACTIVITY
            await activityMiddleware(req, user.id, 'Email Verified', 'AUTH');

            return res.status(StatusCodes.OK).json(responseData);
        }else{
            const responseData = {
                error: true,
                message: `Invalid/Expired Token`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            };
        
            // TRACK THE ACTIVITY
            await activityMiddleware(req, null, 'Invalid/Expired Token', 'AUTH');

            return res.status(StatusCodes.BAD_REQUEST).json(responseData);
        }

    } catch (err) {
        console.error('Unexpected Error:', err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            error: true,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}

module.exports = { verifyuser };