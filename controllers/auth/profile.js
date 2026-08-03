const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcrypt");
const { isValidEmail } = require("../../utils/isValidEmail");
const pg = require("../../db/pg");
const jwt = require("jsonwebtoken");
const { calculateExpiryDate } = require("../../utils/expiredate");
const { sendEmail } = require("../../utils/sendEmail");
const { authMiddleware } = require("../../middleware/authentication");

async function profile(req, res) {
    // Destructure phone and email from request params
    const { phone, email } = req.query;

    console.log('params', req.params)

    let user;

    // If phone or email is provided, search for the user in the User table
    if (phone || email) {
        try {
            const query = `SELECT * FROM skytobi."User" WHERE ${phone ? 'phone = $1' : 'email = $1'}`;
            const value = phone || email;
            const { rows } = await pg.query(query, [value]);

            if (rows.length > 0) {
                user = rows[0];
                console.log(user)
            } else {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "User not found.",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: ["User not found with the provided phone or email."]
                });
            }
        } catch (error) {
            console.error(error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Internal Server Error",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["An error occurred while fetching the user."]
            });
        }
    } else {
        // Fetch a fresh copy of the authenticated user instead of the stale JWT payload
        try {
            const { rows: [authenticatedUser] } = await pg.query(
                `SELECT * FROM skytobi."User" WHERE id = $1`,
                [req.user.id]
            );
            user = authenticatedUser;
        } catch (error) {
            console.error(error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Internal Server Error",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["An error occurred while fetching the authenticated user."]
            });
        }
    }

    if (user) {
        try {
            const { rows: [savingsAccount] } = await pg.query(`
                SELECT s.accountnumber, s.routingnumber, s.status, s.savingsproductid, sp.currency
                FROM skytobi."savings" s
                LEFT JOIN skytobi."savingsproduct" sp ON sp.id = s.savingsproductid
                WHERE s.userid = $1
                ORDER BY CASE WHEN s.status = 'ACTIVE' THEN 0 ELSE 1 END, s.id ASC
                LIMIT 1
            `, [user.id]);

            user.accountnumber = savingsAccount?.accountnumber || user.accountnumber || null;
            user.routingnumber = savingsAccount?.routingnumber || null;
            user.currency = savingsAccount?.currency || user.currency || null;
            user.accountstatus = savingsAccount?.status || null;
            user.transferblocked = savingsAccount ? savingsAccount.status !== 'ACTIVE' : false;

            // Fetch membership details for the user
            const membershipQuery = `
                SELECT m.*, dm.member AS membername
                FROM skytobi."Membership" m
                LEFT JOIN skytobi."DefineMember" dm ON m.member = dm.id
                WHERE m.userid = $1
            `;
            const { rows: membershipRows } = await pg.query(membershipQuery, [user.id]);

            // Add membership details to the user object
            user.membership = membershipRows.length > 0 ? membershipRows : null;
        } catch (error) {
            console.error(error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Internal Server Error",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["An error occurred while fetching the membership details."]
            });
        }

        return res.status(StatusCodes.OK).json({
            status: true, 
            message: "Profile fetched successfully.",
            statuscode: StatusCodes.OK,
            data: user,
            errors: []
        });
    }
}

module.exports = { profile }
