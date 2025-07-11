const { StatusCodes } = require("http-status-codes");
const speakeasy = require('speakeasy');
const pg = require("../../db/pg");
const { sendEmail } = require("../../utils/sendEmail");

const sendOtp = async (req, res) => {
    const user = req.user;

    try {
        // Generate a secret for the user
        const secret = speakeasy.generateSecret({ length: 20 });

        // Generate a time-based OTP
        const otp = speakeasy.totp({
            secret: secret.base32,
            encoding: 'base32'
        });

        await sendEmail({
            to: user.email,  
            subject: "Your Secure OTP for Sky Trust Bank",
            html: `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; background-color: #f9f9f9; border-radius: 8px; border: 1px solid #ddd;">
                        <p style="font-size: 18px; font-weight: bold; color: #2c3e50;">Dear ${user.firstname},</p>
                        <p style="font-size: 16px; color: #34495e; margin-bottom: 20px;">Your One-Time Password (OTP) for proceeding with your current activity on Sky Trust Bank is: <strong style="color: #e74c3c; font-size: 20px;">${otp}</strong>.</p>
                        <p style="font-size: 16px; color: #34495e; margin-bottom: 20px;">This OTP is confidential and should not be shared with anyone. It is intended solely for your use to continue with your activity. Sky Trust Bank will never ask you for your OTP. If you did not request this OTP or suspect any unauthorized activity, please contact our support team immediately.</p>
                        <p style="font-size: 16px; color: #34495e; margin-bottom: 20px;">Thank you for your attention to security.</p>
                        <p style="font-size: 16px; color: #34495e;">Best regards,<br><span style="font-weight: bold; color: #2c3e50;">Sky Trust Bank Team</span></p>
                   </div>`
        });

        // Delete all OTPs associated with the user.id
        const deleteOtpQuery = {
            text: `DELETE FROM skyeu."otp" WHERE userid = $1`,
            values: [user.id]
        };
        await pg.query(deleteOtpQuery);   

        // Add OTP to the database
        const otpQuery = {
            text: `INSERT INTO skyeu."otp" (userid, otp) VALUES ($1, $2)`,
            values: [user.id, otp]
        };
        await pg.query(otpQuery);

        // Here you would send the OTP to the user via email, SMS, etc.
        // For demonstration, we'll just return it in the response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "OTP sent successfully",
            statuscode: StatusCodes.OK,
            data: { otp },
            errors: []
        });
    } catch (error) {
        console.error("Error sending OTP:", error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal server error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { sendOtp };
