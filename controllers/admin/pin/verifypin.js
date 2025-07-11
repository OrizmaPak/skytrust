const { StatusCodes } = require("http-status-codes");
const jwt = require("jsonwebtoken");
const pg = require("../../../db/pg");

const verifyPin = async (req, res) => {
    const { id, pin } = req.body;

    if (!pin) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Pin is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        // Fetch the user by id
        const { rows: [user] } = await pg.query(`SELECT pin FROM skyeu."User" WHERE id = $1`, [id]);
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "User not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        if (user.pin == 'BLOCKED') {
            return res.status(StatusCodes.UNAUTHORIZED).json({
                status: false,
                message: "Pin is blocked, Please go and reset your pin",
                statuscode: StatusCodes.UNAUTHORIZED,
                data: null,
                errors: []
            });
        }

        if (user.pin == 'AUTH_BLOCKED') {
            return res.status(StatusCodes.UNAUTHORIZED).json({
                status: false,
                message: "Pin is blocked, You will have to contact support for further assistance",
                statuscode: StatusCodes.UNAUTHORIZED,
                data: null,
                errors: []
            });
        }

        if (!user.pin) {
            if (pin != '1234') {
                return res.status(StatusCodes.UNAUTHORIZED).json({
                    status: false,
                    message: "Invalid Pin",
                    statuscode: StatusCodes.UNAUTHORIZED,
                    data: null,
                    errors: []
                });
            } else {
                return res.status(StatusCodes.OK).json({
                    status: true,
                    message: "Pin is Correct",
                    statuscode: StatusCodes.OK,
                    data: null,
                    errors: []
                });
            }
        }

        // Verify the provided pin with the stored encrypted pin
        const decoded = jwt.verify(user.pin, process.env.JWT_SECRET);
        const isPinValid = decoded.pin === pin;

        if (!isPinValid) {
            return res.status(StatusCodes.UNAUTHORIZED).json({
                status: false,
                message: "Invalid Pin",
                statuscode: StatusCodes.UNAUTHORIZED,
                data: null,
                errors: []
            });
        }

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Pin is correct",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error("Error verifying pin:", error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal server error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { verifyPin };
