const { StatusCodes } = require("http-status-codes");
const prisma = require("../../db/prisma");
const bcrypt = require("bcryptjs");
const {isValidEmail}  = require("../../utils/isValidEmail");
const jwt = require("jsonwebtoken");
const pg = require("../../db/pg");
const { sendEmail } = require("../../utils/sendEmail");
const { calculateExpiryDate } = require("../../utils/expiredate");
const { activityMiddleware } = require("../../middleware/activity"); // Added tracker middleware
const { uploadToGoogleDrive } = require("../../utils/uploadToGoogleDrive");
const { autoAddMembershipAndAccounts } = require("../../middleware/autoaddmembershipandaccounts");
const { manageSavingsAccount } = require("../savings/createaccount/createaccount");

const signup = async (req, res) => {
    const { firstname, lastname, branch=1, email, password, phone, othernames = '', verify = false, device = '', country = '', state = '' } = req.body;
    console.log({ firstname, lastname, email, password, othernames, ema: isValidEmail(email) });
    

    // Basic validation
    if (!firstname || !lastname || !email || !password || !phone || !isValidEmail(email) || !branch) {
        let errors = [];
        if (!firstname) {
            errors.push({
                field: 'First Name',
                message: 'First name not found' 
            }); 
        }
        // if (!branch) {
        //     errors.push({
        //         field: 'Branch',
        //         message: 'Branch not found'
        //     });
        // }
        if (!lastname) {
            errors.push({
                field: 'Last Name',
                message: 'Last name not found'
            });
        }
        if (!email) {
            errors.push({
                field: 'Email',
                message: 'Email not found'
            });
        }
        if (!phone) {
            errors.push({
                field: 'Phone',
                message: 'Phone not found'
            });
        }
        if (!isValidEmail(email)) {
            errors.push({
                field: 'Email',
                message: 'Invalid email format'
            });
        }
        if (!password) {
            errors.push({
                field: 'Password',
                message: 'Password not found'
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
        // Check if the branch exists in the branch table
        const branchExistsQuery = `SELECT * FROM skyeu."Branch" WHERE id = $1`;
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

        // Check if email already exists using raw query
        const { rows: theuser } = await pg.query(`SELECT * FROM skyeu."User" WHERE email = $1`, [email]);

        // Check if phone number already exists using raw query
        const { rows: phoneUser } = await pg.query(`SELECT * FROM skyeu."User" WHERE phone = $1`, [phone]);

        // CHECKING IF ITS AN ACTIVE USER IF HE EXISTS
        if (theuser.length > 0 && theuser[0].status != 'ACTIVE') {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Your account has been ${theuser[0].status}`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // WHEN THE ACCOUNT IS ALREADY IN USE
        if (theuser.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Email already in use",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // WHEN THE PHONE NUMBER IS ALREADY IN USE
        if (phoneUser.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Phone number already in use",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Insert new user using raw query
        const { rows: [saveuser] } = await pg.query(`INSERT INTO skyeu."User" 
        (firstname, lastname, othernames, email, password, permissions, country, state, phone, dateadded) 
        VALUES ($1, $2, $3, $4, $5, 'NEWUSER', $6, $7, $8, $9) RETURNING id`, [firstname, lastname, othernames, email, hashedPassword, country, state, phone, new Date()]);
        const userId = saveuser.id;
        console.log(saveuser)
        const user = saveuser;

        

        // send welcome email
        sendEmail({
            to: email,
            subject: 'Welcome to Sky Trust Bank! 🎉',
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
                    <h1 style="margin: 0;">Welcome to Sky Trust Bank! 🎉</h1>
                  </div>
                  <div style="padding: 20px;">
                    <p style="font-size: 16px; color: #333333;">Hi <strong>${firstname}</strong>,</p>
                    <p style="font-size: 16px; color: #333333;">Welcome to <strong>Sky Trust Bank</strong>! We're thrilled to have you as a valued customer on your journey to <strong>financial success</strong>.</p>
                    <h2 style="color: #FF0000;">What’s Next?</h2>
                    <ul style="font-size: 16px; color: #333333; padding-left: 20px;">
                      <li>Manage Your Finances: Access a wide range of banking services tailored to your needs.</li>
                      <li>Achieve Your Goals: Benefit from personalized financial advice and solutions.</li>
                      <li>Stay Informed: Monitor your account activities and transactions with ease.</li>
                    </ul>
                    <h2 style="color: #FF0000;">Get Started</h2>
                    <ol style="font-size: 16px; color: #333333; padding-left: 20px;">
                      <li><a href="#" style="color: #FF0000; text-decoration: none;">Log in to your account</a> using the email you registered with: [User's Email].</li>
                      <li>Update your profile and banking preferences.</li>
                      <li>Begin your journey towards financial empowerment with us!</li>
                    </ol>
                    <p style="font-size: 16px; color: #333333;">If you have any questions or need assistance, please do not reply to this email as it is automated. Instead, reach out to our support team at <a href="mailto:support@skybank.com" style="color: #FF0000; text-decoration: none;">support@skybank.com</a>.</p>
                    <p style="font-size: 16px; color: #333333;">Thank you for choosing Sky Trust Bank. We’re here to support you in achieving your financial goals and ensuring your success!</p>
                  </div>
                  <div style="background-color: #f4f4f4; padding: 20px; text-align: center;">
                    <p style="font-size: 12px; color: #666666;">&copy; 2024 Sky Trust Bank. All rights reserved. Please do not reply to this email.</p>
                  </div>
                </div>
              </body>
              </html>
            `
          });
          
         


        // WE WANT TO SIGN THE USER IN AUTOMATICALLY
        const token = jwt.sign({ user: userId }, process.env.JWT_SECRET, {
            expiresIn: process.env.SESSION_EXPIRATION_HOUR + 'h',
        });

        await pg.query(`INSERT INTO skyeu."Session" 
            (sessiontoken, userid, expires, device) 
            VALUES ($1, $2, $3, $4) 
            `, [token, userId, calculateExpiryDate(process.env.SESSION_EXPIRATION_HOUR), device])

            // RECORD THE ACTIVITY
        await activityMiddleware(res, user.id, `Registered and Logged in Successfully ${user.permissions == 'NEWUSER' ? 'and its the first login after registering' : ''} on a ${device} device`, 'AUTH')

        const { rows: [details] } = await pg.query(`SELECT * FROM skyeu."User" WHERE id= $1`, [userId])


        let messagestatus
        // CHECK IF THE USER HAS VALIDATED HIS EMAIL
        if (!details.emailverified && verify) {
            // create verification token
            const vtoken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: process.env.VERIFICATION_EXPIRATION_HOUR + 'h' });
            // create a verification link and code
            await pg.query(`INSERT INTO skyeu."VerificationToken" 
                                (identifier, token, expires) 
                                VALUES ($1, $2, $3)`, [user.id, vtoken, calculateExpiryDate(process.env.VERIFICATION_EXPIRATION_HOUR)])

            // send confirmation email
            await sendEmail({
                to: email,
                subject: 'Confirm Your Email to Begin Your Journey with SkyTrust Bank 🎉',
                text: 'Verification is key to unlocking financial freedom. Confirm your email to start your path to financial empowerment with SkyTrust Bank.',
                html: `<!DOCTYPE html>
                        <html>
                        <head>
                            <title>Email Verification</title>
                        </head>
                        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333333; margin: 0; padding: 0; line-height: 1.6;">
                            <div style="width: 80%; max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <div style="text-align: center; padding-bottom: 20px;">
                                <h1 style="color: #4CAF50; margin: 0; font-size: 24px;">Welcome to SkyTrust Bank!</h1>
                            </div>
                            <div style="margin: 20px 0;">
                                <p>Hello ${user.firstname},</p>
                                <p>Thank you for joining <strong>SkyTrust Bank</strong>! To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
                                <a href="${process.env.NEXT_PUBLIC_RETURN_APP_BASE}${vtoken}" style="display: block; width: 200px; margin: 20px auto; text-align: center; background-color: #4CAF50; color: #ffffff; padding: 10px; border-radius: 5px; text-decoration: none; font-weight: bold;">Verify Email Address</a>
                                <p>If the button above doesn't work, copy and paste the following link into your browser:</p>
                                <p><a href="${process.env.NEXT_PUBLIC_RETURN_APP_BASE}${vtoken}" style="color: #4CAF50;">${process.env.NEXT_PUBLIC_RETURN_APP_BASE}${vtoken}</a></p>
                                <p>If you didn't create an account with SkyTrust Bank, please ignore this email.</p>
                                <p>Best Regards,<br>The SkyTrust Bank Team</p>
                            </div>
                            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666666;">
                                <p>&copy; 2024 SkyTrust Bank. All rights reserved.</p>
                                <p>1234 Banking Avenue, Finance City, Economy Nation</p>
                            </div>
                            </div>
                        </body>
                        </html>
                `
              })
              
            //   RECORD THE ACTIVITY
            await activityMiddleware(res, user.id, 'Verification Email Sent', 'AUTH')

            messagestatus = true
        }
        req.newuser = saveuser
        let accountaction = await autoAddMembershipAndAccounts(req, res, 0)

        const responseData = {
            status: accountaction,
            message: accountaction ? `Welcome ${details.firstname}` : 'Something went wrong with creating memberships and other accounts, please contact support',
            statuscode: accountaction ? StatusCodes.OK : StatusCodes.INTERNAL_SERVER_ERROR,
            data: accountaction ? {
                user: {
                    ...details,
                    password: undefined
                },
                token,
                expires: calculateExpiryDate(process.env.SESSION_EXPIRATION_HOUR),
                verificationmail: messagestatus ? 'Email sent' : '',
            } : null,
            errors: accountaction ? [] : ['Membership and account creation failed']
        };

        // Fetch DefineMember records with addmember set to 'YES'
        const { rows: defineMembers } = await pg.query(`
            SELECT id FROM skyeu."DefineMember" WHERE addmember = 'YES'
        `);

        // Iterate over each DefineMember and create a Membership record
        for (const defineMember of defineMembers) {
            await pg.query(`
                INSERT INTO skyeu."Membership" (member, userid, createdby, dateadded, status)
                VALUES ($1, $2, $3, NOW(), 'ACTIVE')
            `, [defineMember.id, userId, userId]);
        }

        const savingsDetails = {
            savingsproductid: 1,
            userid: userId,
            amount: 1000.0,
            branch: 1,
            registrationpoint: 0,
            registrationcharge: 50.0,
            registrationdesc: 'Initial deposit',
            bankname1: 'Bank A',
            bankaccountname1: 'Jane Doe',
            bankaccountnumber1: '9067890987',
            bankname2: 'Bank k',
            bankaccountnumber2: '',
            accountofficer: userId.toString()
        };

        req.body = savingsDetails;
        await manageSavingsAccount(req, res);

        // return res.status(StatusCodes.OK).json(responseData);
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

module.exports = {
    signup
};