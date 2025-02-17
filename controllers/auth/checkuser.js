const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");

const checkUser = async (req, res) => {
    try {
        const { email, phone } = req.query;

        if (!email && !phone) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Email or phone number is required",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Email or phone number is required"]
            });
        }

        let query = `SELECT * FROM sky."User" WHERE `;
        let params = [];

        if (email) {
            query += `email = $1`;
            params.push(email);
        }

        if (phone) {
            if (email) {
                query += ` OR `;
            }
            query += `phone = $${params.length + 1}`;
            params.push(phone);
        }

        const { rows: users } = await pg.query(query, params);

        if (users.length > 0) {
            const existingUser = users[0];
            const existingEmail = existingUser.email === email;
            const existingPhone = existingUser.phone === phone;

            return res.status(StatusCodes.OK).json({
                status: false,
                message: "User already exist",
                statuscode: StatusCodes.OK,
                data: {
                    user: existingUser,
                    exists: {
                        email: existingEmail,
                        phone: existingPhone
                    }
                },
                errors: []
            });
        } else {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: true,
                message: "User not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["User not found"]
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

module.exports = { checkUser };


