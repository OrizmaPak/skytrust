const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcrypt");
const { isValidEmail } = require("../../utils/isValidEmail");
const pg = require("../../db/pg");
const jwt = require("jsonwebtoken");
const { calculateExpiryDate } = require("../../utils/expiredate");
const { sendEmail } = require("../../utils/sendEmail");
const { activityMiddleware } = require("../../middleware/activity");

async function login(req, res) {
    const { email, password, verify = '', device = '' } = req.body;
    console.log({ email, password });

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
        const { rows: [existingUser] } = await pg.query(`SELECT * FROM skyeu."User" WHERE email = $1`, [email]);

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
            const token = jwt.sign({ user: existingUser }, process.env.JWT_SECRET, {
                expiresIn: process.env.SESSION_EXPIRATION_HOUR + 'h',
            });
            console.log(token);

            // STORE THE SESSION
            await pg.query(`INSERT INTO skyeu."Session" 
            (sessiontoken, userid, expires, device) 
            VALUES ($1, $2, $3, $4) 
            `, [token, existingUser.id, calculateExpiryDate(process.env.SESSION_EXPIRATION_HOUR), device]);

            let messagestatus;
            // CHECK IF THE USER HAS VALIDATED HIS EMAIL
            if (!existingUser.emailverified && verify) {
                // create verification token
                const vtoken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: process.env.VERIFICATION_EXPIRATION_HOUR + 'h' });
                // create a verification link and code
                await pg.query(`INSERT INTO skyeu."VerificationToken" 
                                (identifier, token, expires) 
                                VALUES ($1, $2, $3)`, [existingUser.id, vtoken, calculateExpiryDate(process.env.VERIFICATION_EXPIRATION_HOUR)]);

                // send confirmation email
                await sendEmail({
                    to: email,
                    subject: 'Confirm Your Email to Begin Your Journey with Sky Trust Cooperative 🎉',
                    text: 'Verification is key to unlocking financial freedom. Confirm your email to start your path to financial empowerment with Sky Trust Cooperative Society.',
                    html: `<!DOCTYPE html>
                        <html>
                        <head>
                            <title>Email Verification</title>
                        </head>
                        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333333; margin: 0; padding: 0; line-height: 1.6;">
                            <div style="width: 80%; max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <div style="text-align: center; padding-bottom: 20px;">
                                <h1 style="color: #4CAF50; margin: 0; font-size: 24px;">Welcome to Sky Trust Cooperative Society!</h1>
                            </div>
                            <div style="margin: 20px 0;">
                                <p>Hello ${existingUser.firstname},</p>
                                <p>Thank you for joining <strong>Sky Trust Multi-Purpose Cooperative Society</strong>! To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
                                <a href="${process.env.NEXT_PUBLIC_RETURN_APP_BASE}${vtoken}" style="display: block; width: 200px; margin: 20px auto; text-align: center; background-color: #4CAF50; color: #ffffff; padding: 10px; border-radius: 5px; text-decoration: none; font-weight: bold;">Verify Email Address</a>
                                <p>If the button above doesn't work, copy and paste the following link into your browser:</p>
                                <p><a href="${process.env.NEXT_PUBLIC_RETURN_APP_BASE}${vtoken}" style="color: #4CAF50;">${process.env.NEXT_PUBLIC_RETURN_APP_BASE}${vtoken}</a></p>
                                <p>If you didn't create an account with Sky Trust Cooperative Society, please ignore this email.</p>
                                <p>Best Regards,<br>The Sky Trust Team</p>
                            </div>
                            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666666;">
                                <p>&copy; 2024 Sky Trust Multi-Purpose Cooperative Society. All rights reserved.</p>
                                <p>1234 Farming Lane, Prosperity City, Agriculture Nation</p>
                            </div>
                            </div>
                        </body>
                        </html>
                        
                        `
                });

                //  TRACK THE ACTIVITY
                await activityMiddleware(req, existingUser.id, 'Verification Email Sent', 'AUTH');
                messagestatus = true;
            }

            // CHECK IF THIS IS THE FIRST TIME THE USER IS LOGINING
            if (existingUser.permissions == 'NEWUSER') {
                await pg.query(`UPDATE skyeu."User" SET permissions = null WHERE id = $1`, [existingUser.id]);
            }

            // Fetch account number and currency from savings table
            const { rows: [savingsAccount] } = await pg.query(`SELECT accountnumber, savingsproductid FROM skyeu."savings" WHERE userid = $1`, [existingUser.id]);
            const accountNumber = savingsAccount ? savingsAccount.accountnumber : null;

            // Fetch currency using savings product ID
            let currency = null;
            if (savingsAccount && savingsAccount.savingsproductid) {
                const { rows: [savingsProduct] } = await pg.query(`SELECT currency FROM skyeu."savingsproduct" WHERE id = $1`, [savingsAccount.savingsproductid]);
                currency = savingsProduct ? savingsProduct.currency : null;
            }

            //  TRACK THE ACTIVITY
            await activityMiddleware(req, existingUser.id, `Logged in Successfully ${existingUser.permissions == 'NEWUSER' ? 'and its the first login after registering' : ''} on a ${device} device`, 'AUTH');
          
            const { password, ...userWithoutPassword } = existingUser;
            const responseData = {
                status: true,
                message: `Welcome ${existingUser.firstname}`,
                statuscode: StatusCodes.OK,
                data: {
                    user: { ...userWithoutPassword, accountnumber: accountNumber, currency },
                    token,
                    expires: calculateExpiryDate(process.env.SESSION_EXPIRATION_HOUR),
                    verificationmail: messagestatus ? 'Email sent' : ''
                },
                errors: []
            };

            return res.status(StatusCodes.OK).json(responseData);
        } else {
            //  TRACK THE ACTIVITY
            await activityMiddleware(req, existingUser.id, 'Inputted wrong password', 'AUTH');
            
            return res.status(StatusCodes.UNAUTHORIZED).json({
                status: false,
                message: "Invalid credentials",
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
    login 
};