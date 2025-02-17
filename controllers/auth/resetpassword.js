const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcrypt");
const pg = require("../../db/pg");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../../utils/sendEmail");
const { activityMiddleware } = require("../../middleware/activity");

const resetPassword = async (req, res) => {
  try {
    const { newpassword, passwordtoken } = req.body;

    // Basic validation
    if (!newpassword || !passwordtoken) {
      let errors = [];
      if (!newpassword) {
        errors.push({ field: 'New password', message: 'New password not found' });
      }
      if (!passwordtoken) {
        errors.push({ field: 'Password token', message: 'Password token not found' });
      }

      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Missing Fields",
        statuscode: StatusCodes.BAD_REQUEST,
        data: null,
        errors: errors
      });
    }

    // Verify the token
    let decoded;
    try {
      decoded = jwt.verify(passwordtoken, process.env.JWT_SECRET);
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Token verification error",
        statuscode: StatusCodes.BAD_REQUEST,
        data: null,
        errors: []
      });
    }

    const email = decoded.email;

    if (!email) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Expired token",
        statuscode: StatusCodes.BAD_REQUEST,
        data: null,
        errors: []
      });
    }

    // Check if the token exists in the database
    const { rows: [user] } = await pg.query(`SELECT * FROM sky."VerificationToken" WHERE token = $1`, [passwordtoken]);
    if (!user) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Expired token",
        statuscode: StatusCodes.BAD_REQUEST,
        data: null,
        errors: []
      });
    }

    // Check if email exists
    const { rows: [existingUser] } = await pg.query(`SELECT * FROM sky."User" WHERE email = $1`, [email]);
    if (!existingUser) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Email cannot be found. Try again",
        statuscode: StatusCodes.BAD_REQUEST,
        data: null,
        errors: []
      });
    }

    // Hash the new password and update
    const hashpwd = await bcrypt.hash(newpassword, 10);
    await pg.query(`UPDATE sky."User" SET password = $1 WHERE email = $2`, [hashpwd, email]);
    
    // Remove the verification token
    await pg.query(`DELETE FROM sky."VerificationToken" WHERE token = $1`, [passwordtoken]);

    // Send confirmation email
    await sendEmail({
      to: email,
      subject: 'Your Divine Help Farmers Password Has Been Successfully Changed',
      text: "A secure password is the key to protecting your digital life. If this change wasn't made by you, take action now.",
      html: `<!DOCTYPE html>
            <html>
            <head>
                <title>Password Changed Notification</title>
            </head>
            <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333333; margin: 0; padding: 0; line-height: 1.6;">
                <div style="width: 80%; max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="text-align: center; padding-bottom: 20px;">
                    <h1 style="color: #4CAF50; margin: 0; font-size: 24px;">Password Change Confirmation</h1>
                </div>
                <div style="margin: 20px 0;">
                    <p>Hello ${existingUser.firstname},</p>
                    <p>We wanted to let you know that your Divine Help Farmers account password was recently changed. If you made this change, no further action is required.</p>
                    <p>If you did not change your password, please secure your account immediately by resetting your password and reviewing your recent account activity.</p>
                    <p>For your security, we recommend using a strong and unique password that you do not use on any other sites.</p>
                    <p>If you need assistance, please contact our support team.</p>
                    <p>Best Regards,<br>The Divine Help Farmers Team</p>
                </div>
                <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666666;">
                    <p>&copy; 2024 divine. All rights reserved.</p>
                    <p>1234 Farming Lane, Harvest City, Agriculture Country</p>
                </div>
                </div>
            </body>
            </html>`
    });

    //  TRACK THE ACTIVITY
    await activityMiddleware(req, existingUser.id, 'Password Changed', 'AUTH');

    // Return success response
    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Password updated",
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
};

module.exports = { resetPassword }