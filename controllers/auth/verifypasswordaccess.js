const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcrypt");
const { isValidEmail } = require("../../utils/isValidEmail");
const pg = require("../../db/pg");
const jwt = require("jsonwebtoken");
const { calculateExpiryDate } = require("../../utils/expiredate");
const { sendEmail } = require("../../utils/sendEmail");
const { activityMiddleware } = require("../../middleware/activity");

async function verifypasswordaccess(req, res) {
    const {  password } = req.body;
    const user = req.user;
    const email = user.email;

    // Basic validation
    if (!email || !password || !isValidEmail(email)) {
        let errors = [];
        if (!email) {
            errors.push({
                field: 'Email',
                message: 'Email not found'
            });
        }
        if (!password) {
            errors.push({
                field: 'Password',
                message: 'Password not found'
            });
        }
        if (!isValidEmail(email)) {
            errors.push({
                field: 'Email',
                message: 'Invalid email format'
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
        // Check if email already exists using raw query
        const { rows: [existingUser] } = await pg.query(`SELECT * FROM sky."User" WHERE email = $1`, [email]);

        if (!existingUser) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Email not registered",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }
        if (existingUser.status != 'ACTIVE') {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Your this account has been ${existingUser.status}`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, existingUser.password);

        if (isPasswordValid) {
            
            //  TRACK THE ACTIVITY
            await activityMiddleware(req, existingUser.id, `Password Verified`, 'AUTH');
          

            const { password, ...userWithoutPassword } = existingUser;
            const responseData = {
                status: true,
                message: `Password Verified`,
                statuscode: StatusCodes.OK,
                data: existingUser,
                errors: []
            };

            return res.status(StatusCodes.OK).json(responseData);
        } else {
            //  TRACK THE ACTIVITY
            await activityMiddleware(req, existingUser.id, 'Inputted wrong password', 'AUTH');
            
            return res.status(StatusCodes.UNAUTHORIZED).json({
                status: false,
                message: "Invalid Password",
                statuscode: StatusCodes.UNAUTHORIZED,
                data: null,
                errors: []
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        //  TRACK THE ACTIVITY
        await activityMiddleware(req, existingUser.id, 'Login Attempt Failed due to an unexpected error', 'AUTH');
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
    verifypasswordaccess 
};