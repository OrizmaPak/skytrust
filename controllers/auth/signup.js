const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcryptjs");
const { isValidEmail } = require("../../utils/isValidEmail");
const jwt = require("jsonwebtoken");
const pg = require("../../db/pg");
const { sendEmail } = require("../../utils/sendEmail");
const { calculateExpiryDate } = require("../../utils/expiredate");
const { activityMiddleware } = require("../../middleware/activity");
const { autoAddMembershipAndAccounts } = require("../../middleware/autoaddmembershipandaccounts");

const signup = async (req, res) => {
    const {
        firstname,
        lastname,
        branch = 1,
        email,
        password,
        phone,
        othernames = '',
        verify = false,
        device = '',
        country = '',
        state = ''
    } = req.body;

    if (!firstname || !lastname || !email || !password || !phone || !isValidEmail(email) || !branch) {
        let errors = [];

        if (!firstname) errors.push({ field: 'First Name', message: 'First name not found' });
        if (!lastname) errors.push({ field: 'Last Name', message: 'Last name not found' });
        if (!email) errors.push({ field: 'Email', message: 'Email not found' });
        if (!phone) errors.push({ field: 'Phone', message: 'Phone not found' });
        if (!isValidEmail(email)) errors.push({ field: 'Email', message: 'Invalid email format' });
        if (!password) errors.push({ field: 'Password', message: 'Password not found' });

        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Missing Fields",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors
        });
    }

    let verificationToken = null;
    let token = null;
    let details = null;
    let setupResult = null;

    try {
        const branchExistsQuery = `SELECT * FROM skytobi."Branch" WHERE id = $1`;
        const { rows: branchExistsResult } = await pg.query(branchExistsQuery, [branch]);

        if (branchExistsResult.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Branch does not exist.",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Branch does not exist."]
            });
        }

        const preExistingUser = await pg.query(`SELECT * FROM skytobi."User" WHERE email = $1`, [email]);
        const preExistingPhone = await pg.query(`SELECT * FROM skytobi."User" WHERE phone = $1`, [phone]);

        if (preExistingUser.rows.length > 0 && preExistingUser.rows[0].status !== 'ACTIVE') {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Your account has been ${preExistingUser.rows[0].status}`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        if (preExistingUser.rows.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Email already in use",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        if (preExistingPhone.rows.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Phone number already in use",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        await pg.withTransaction(async (client) => {
            const hashedPassword = await bcrypt.hash(password, 10);
            const createdAt = new Date();

            const { rows: [saveuser] } = await client.query(`
                INSERT INTO skytobi."User"
                (firstname, lastname, othernames, email, password, permissions, country, state, phone, branch, dateadded)
                VALUES ($1, $2, $3, $4, $5, 'NEWUSER', $6, $7, $8, $9, $10)
                RETURNING id, firstname, branch, registrationpoint
            `, [firstname, lastname, othernames, email, hashedPassword, country, state, phone, branch, createdAt]);

            const userId = saveuser.id;
            token = jwt.sign({ user: userId }, process.env.JWT_SECRET, {
                expiresIn: process.env.SESSION_EXPIRATION_HOUR + 'h',
            });

            await client.query(`
                INSERT INTO skytobi."Session" (sessiontoken, userid, expires, device)
                VALUES ($1, $2, $3, $4)
            `, [token, userId, calculateExpiryDate(process.env.SESSION_EXPIRATION_HOUR), device]);

            await activityMiddleware(res, userId, `Registered and Logged in Successfully on a ${device} device`, 'AUTH');

            if (verify) {
                verificationToken = jwt.sign(
                    { email },
                    process.env.JWT_SECRET,
                    { expiresIn: process.env.VERIFICATION_EXPIRATION_HOUR + 'h' }
                );

                await client.query(`
                    INSERT INTO skytobi."VerificationToken" (identifier, token, expires)
                    VALUES ($1, $2, $3)
                `, [userId, verificationToken, calculateExpiryDate(process.env.VERIFICATION_EXPIRATION_HOUR)]);
            }

            req.newuser = {
                id: userId,
                branch: saveuser.branch || branch,
                registrationpoint: saveuser.registrationpoint || 0
            };

            setupResult = await autoAddMembershipAndAccounts(req, res, 0, client);
            if (!setupResult.status) {
                throw new Error(setupResult.error || 'Membership and account creation failed');
            }

            const userDetailsResult = await client.query(`SELECT * FROM skytobi."User" WHERE id = $1`, [userId]);
            details = userDetailsResult.rows[0];
        });

        sendEmail({
            to: email,
            subject: 'Welcome to Sky Trust Bank! ðŸŽ‰',
            text: 'Thank you for choosing Sky Trust Bank. Your journey to financial success begins now.',
            html: `<!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to Sky Trust Bank!</title>
              </head>
              <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                  <div style="background-color: #FF0000; padding: 20px; text-align: center; color: #ffffff;">
                    <h1 style="margin: 0;">Welcome to Sky Trust Bank! ðŸŽ‰</h1>
                  </div>
                  <div style="padding: 20px;">
                    <p style="font-size: 16px; color: #333333;">Hi <strong>${firstname}</strong>,</p>
                    <p style="font-size: 16px; color: #333333;">Welcome to <strong>Sky Trust Bank</strong>! We're thrilled to have you as a valued customer on your journey to <strong>financial success</strong>.</p>
                  </div>
                </div>
              </body>
              </html>`
        }).catch((error) => console.error('Welcome email failed:', error));

        if (verify && verificationToken) {
            sendEmail({
                to: email,
                subject: 'Confirm Your Email to Begin Your Journey with SkyTrust Bank',
                text: 'Verification is key to unlocking financial freedom.',
                html: `<!DOCTYPE html>
                        <html>
                        <head>
                            <title>Email Verification</title>
                        </head>
                        <body>
                            <p>Hello ${details.firstname},</p>
                            <p>Verify your email address by clicking the button below:</p>
                            <a href="${process.env.NEXT_PUBLIC_RETURN_APP_BASE}${verificationToken}">Verify Email Address</a>
                        </body>
                        </html>`
            }).catch((error) => console.error('Verification email failed:', error));
        }

        return res.status(StatusCodes.OK).json({
            status: true,
            message: `Welcome ${details.firstname}`,
            statuscode: StatusCodes.OK,
            data: {
                user: {
                    ...details,
                    password: undefined
                },
                token,
                expires: calculateExpiryDate(process.env.SESSION_EXPIRATION_HOUR),
                verificationmail: verify ? 'Email queued' : '',
                setup: {
                    membershipsCreated: setupResult?.membershipsCreated || 0,
                    savingsAccountsCreated: setupResult?.accountsCreated || 0
                }
            },
            errors: []
        });
    } catch (err) {
        console.error('Unexpected Error:', err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [err.message]
        });
    }
};

module.exports = {
    signup
};
