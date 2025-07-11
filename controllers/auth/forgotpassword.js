const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcrypt");
const { isValidEmail } = require("../../utils/isValidEmail");
const pg = require("../../db/pg");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../../utils/sendEmail");
const { activityMiddleware } = require("../../middleware/activity"); // Added tracker middleware

async function forgotpassword(req, res) {
    const { email } = req.body;
    console.log({ email });

    // Basic validation
    if (!email || !isValidEmail(email)) {
        let errors = [];
        if (!email) {
            errors.push({
                field: 'Email',
                message: 'Email not found'
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
        const { rows: [existingUser] } = await pg.query(`SELECT * FROM skyeu."User" WHERE email = $1`, [email]);

        if (!existingUser) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Email provided is not a registered address",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Generate a new password
        const newPassword = Math.random().toString(36).slice(-8); // Generate a random 8-character password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Sign the new password with JWT
        const signedPassword = jwt.sign({ password: newPassword }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Update the user's password in the database
        await pg.query(`UPDATE skyeu."User" SET password = $1 WHERE id = $2`, [hashedPassword, existingUser.id]);

        // Send the new password via email
        await sendEmail({
            to: email,
            subject: 'Your New Password for Sky Trust',
            text: `Your password has been reset. Your new password is: ${newPassword}`,
            html: `<!DOCTYPE html>
                    <html>
                    <head>
                        <title>Your New Password</title>
                    </head>
                    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333333; margin: 0; padding: 0; line-height: 1.6;">
                        <div style="width: 80%; max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="text-align: center; padding-bottom: 20px;">
                            <h1 style="color: #4CAF50; margin: 0; font-size: 24px;">Your New Password</h1>
                        </div>
                        <div style="margin: 20px 0;">
                            <p>Hello ${existingUser.firstname},</p>
                            <p>Your password has been reset. Your new password is:</p>
                            <p style="font-size: 18px; font-weight: bold;">${newPassword}</p>
                            <p>Please change this password after logging in for security reasons.</p>
                            <p>Best Regards,<br>The Sky Trust Team</p>
                        </div>
                        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666666;">
                            <p>&copy; 2024 Sky Trust. All rights reserved.</p>
                            <p>1234 Farming Lane, Harvest City, Agriculture Country</p>
                        </div>
                        </div>
                    </body>
                    </html>`
        });

        const responseData = {
            status: true,
            message: `A new password has been sent to ${email}`,
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        };

        // TRACK THE ACTIVITY
        await activityMiddleware(req, existingUser.id, 'Password Reset and New Password Sent', 'AUTH');

        return res.status(StatusCodes.OK).json(responseData);

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

module.exports = { forgotpassword }