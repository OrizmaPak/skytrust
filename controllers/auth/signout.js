const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcrypt");
const { isValidEmail } = require("../../utils/isValidEmail");
const pg = require("../../db/pg");
const jwt = require("jsonwebtoken");
const { calculateExpiryDate } = require("../../utils/expiredate");
const { sendEmail } = require("../../utils/sendEmail");
const { activityMiddleware } = require("../../middleware/activity"); // Added tracker middleware

async function signout(req, res) {
    const authorizationHeader = req.headers['authorization'];
    const token = authorizationHeader ? authorizationHeader.split(' ')[1] : null;
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
        const { rows: [user] } = await pg.query(`SELECT * FROM sky."Session" WHERE sessiontoken = $1`, [token]);
        // console.log(user)
        if(user && user.sessiontoken == token){
            const deleteResult = await pg.query(`DELETE FROM sky."Session" WHERE sessiontoken = $1`, [token]);
            console.log("Deletion successful:", deleteResult.rowCount > 0);
            const responseData = {
                status: true,
                message: `Session Ended`,
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            };
        
            // TRACK THE ACTIVITY
            await activityMiddleware(req, user.id, 'Session Ended', 'AUTH');

            return res.status(StatusCodes.OK).json(responseData);
        }else{
            const responseData = {
                status: false,
                message: `Invalid/Expired Session`,
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

module.exports = { signout };