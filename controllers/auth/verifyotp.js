const { StatusCodes } = require("http-status-codes");
const speakeasy = require('speakeasy');
const pg = require("../../db/pg");

const verifyOtp = async (req, res) => {
    const { otp } = req.body;
    const user = req.user;

    if (!otp) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Missing Fields",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        })
    }

    try {
        // Check if the OTP exists in the database
        const { rows: [otpRecord] } = await pg.query(`SELECT * FROM skyeu."otp" WHERE userid = $1 AND otp = $2`, [user.id, otp]);

        if (!otpRecord) {
            return res.status(StatusCodes.UNAUTHORIZED).json({
                status: false,
                message: "Invalid OTP",
                statuscode: StatusCodes.UNAUTHORIZED,
                data: null,
                errors: []
            });
        }

        // Use speakeasy for OTP verification
        // const isOtpValid = speakeasy.totp.verify({
        //     secret: otpRecord.secret, // Use the secret stored in the database
        //     encoding: 'base32',
        //     token: otp,
        //     window: 1 // Allow a window of 1 time step before and after
        // });

        // if (!isOtpValid) {
        //     return res.status(StatusCodes.UNAUTHORIZED).json({
        //         status: false,
        //         message: "Invalid OTP",
        //         statuscode: StatusCodes.UNAUTHORIZED,
        //         data: null,
        //         errors: []
        //     });
        // }

        // Delete the OTP from the database
        await pg.query(`DELETE FROM skyeu."otp" WHERE id = $1`, [otpRecord.id]);

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "OTP verified successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal server error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { verifyOtp }; 