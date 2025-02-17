const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcryptjs");
const {isValidEmail}  = require("../utils/isValidEmail");
const jwt = require("jsonwebtoken");
const pg = require("../db/pg");
const { sendEmail } = require("../utils/sendEmail");
const { calculateExpiryDate } = require("../utils/expiredate");
const { activityMiddleware } = require("../middleware/activity");
const { uploadToGoogleDrive } = require("../utils/uploadToGoogleDrive");

const testing = async (req, res) => {

    // const formData = new FormData(req.body);
    // const { firstname, lastname, email, password, othernames = '', verify = false, device = '', country = '', state = '' } = req.body;
    // console.log({ firstname, lastname, email, password, othernames, ema: isValidEmail(email) });
     // Access uploaded files from req.files
      let newreq = await uploadToGoogleDrive(req, res);
      console.log('this is the signup newreq', newreq.body); 
      console.log('this is the signup req', req.body);
    return res.status(StatusCodes.OK).json(req.body)
 
    // Basic validation
    if (!firstname || !lastname || !email || !password || !isValidEmail(email)) {
        let errors = [];
        if (!firstname) {
            errors.push({
                field: 'First Name',
                message: 'First name not found' 
            }); 
        }
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
        // Check if email already exists using raw query
        const { rows: theuser } = await pg.query(`SELECT * FROM sky."User" WHERE email = $1`, [email]);

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

        if (theuser.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Email already in use",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Insert new user using raw query
        const { rows: [saveuser] } = await pg.query(`INSERT INTO sky."User" 
        (firstname, lastname, othernames, email, password, permissions, country, state, dateadded) 
        VALUES ($1, $2, $3, $4, $5, 'NEWUSER', $6, $7, $8) RETURNING id`, [firstname, lastname, othernames, email, hashedPassword, country, state, new Date()]);
        const userId = saveuser.id;
        console.log(saveuser)
        const user = saveuser;

        // send welcome email
        sendEmail({
            to: email,
            subject: 'Welcome to Divine! 🎉',
            text: 'A penny saved is a penny earned.',
            html: `<!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Welcome to Divine!</title>
                </head>
                <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
                  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                    <div style="background-color: #4CAF50; padding: 20px; text-align: center; color: #ffffff;">
                      <h1 style="margin: 0;">Welcome to Divine! 🎉</h1>
                    </div>
                    <div style="padding: 20px;">
                      <p style="font-size: 16px; color: #333333;">Hi <strong>${firstname}</strong>,</p>
                      <p style="font-size: 16px; color: #333333;">Welcome to <strong>Divine</strong>! We're thrilled to have you on board.</p>
                      <h2 style="color: #4CAF50;">What’s Next?</h2>
                      <ul style="font-size: 16px; color: #333333; padding-left: 20px;">
                        <li>Track Your Expenses: Easily categorize and monitor your spending.</li>
                        <li>Set Financial Goals: Stay on top of your savings and budget targets.</li>
                        <li>Analyze Your Finances: Get insights with detailed reports and analytics.</li>
                      </ul>
                      <h2 style="color: #4CAF50;">Get Started</h2>
                      <ol style="font-size: 16px; color: #333333; padding-left: 20px;">
                        <li><a href="#" style="color: #4CAF50; text-decoration: none;">Log in to your account</a> using the email you registered with: [User's Email].</li>
                        <li>Set up your profile and preferences.</li>
                        <li>Begin your financial journey with Divine!</li>
                      </ol>
                      <p style="font-size: 16px; color: #333333;">If you have any questions or need assistance, feel free to reach out to our support team at <a href="mailto:support@divine.com" style="color: #4CAF50; text-decoration: none;">support@divine.com</a>.</p>
                      <p style="font-size: 16px; color: #333333;">Thank you for choosing Divine. We’re here to help you achieve your financial goals!</p>
                    </div>
                    <div style="background-color: #f4f4f4; padding: 20px; text-align: center;">
                      <p style="font-size: 12px; color: #666666;">&copy; 2024 Divine. All rights reserved.</p>
                    </div>
                  </div>
                </body>
                </html>
                `
        })


        // WE WANT TO SIGN THE USER IN AUTOMATICALLY
        const token = jwt.sign({ user: userId }, process.env.JWT_SECRET, {
            expiresIn: process.env.SESSION_EXPIRATION_HOUR + 'h',
        });

        await pg.query(`INSERT INTO sky."Session" 
            (sessiontoken, userid, expires, device) 
            VALUES ($1, $2, $3, $4) 
            `, [token, userId, calculateExpiryDate(process.env.SESSION_EXPIRATION_HOUR), device])


        const activity = await activityMiddleware(req, user.id, `Registered and Logged in Successfully ${user.permissions == 'NEWUSER' ? 'and its the first login after registering' : ''} on a ${device} device`, 'AUTH')
        if (activity instanceof Response) {
            return res.status(activity.status).json(activity.body); // Return the error response from middleware
        }

        const { rows: [details] } = await pg.query(`SELECT * FROM sky."User" WHERE id= $1`, [userId])


        let messagestatus
        // CHECK IF THE USER HAS VALIDATED HIS EMAIL
        if (!details.emailverified && verify) {
            // create verification token
            const vtoken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: process.env.VERIFICATION_EXPIRATION_HOUR + 'h' });
            // create a verification link and code
            await pg.query(`INSERT INTO sky."VerificationToken" 
                                (identifier, token, expires) 
                                VALUES ($1, $2, $3)`, [user.id, vtoken, calculateExpiryDate(process.env.VERIFICATION_EXPIRATION_HOUR)])

            // send confirmation email
            await sendEmail({
                to: email,
                subject: 'Confirm Your Email to Begin Your Divine Journey 🎉',
                text: 'Verification is the key to unlocking your journey. Confirm your email to start your path to smarter budgeting with Divine.',
                html: `<!DOCTYPE html>
                        <html>
                        <head>
                            <title>Email Verification</title>
                        </head>
                        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333333; margin: 0; padding: 0; line-height: 1.6;">
                            <div style="width: 80%; max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <div style="text-align: center; padding-bottom: 20px;">
                                <h1 style="color: #4CAF50; margin: 0; font-size: 24px;">Welcome to Divine!</h1>
                            </div>
                            <div style="margin: 20px 0;">
                                <p>Hello ${user.firstname},</p>
                                <p>Thank you for registering with Divine! To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
                                <a href="${process.env.NEXT_PUBLIC_RETURN_APP_BASE}${vtoken}" style="display: block; width: 200px; margin: 20px auto; text-align: center; background-color: #4CAF50; color: #ffffff; padding: 10px; border-radius: 5px; text-decoration: none; font-weight: bold;">Verify Email Address</a>
                                <p>If the button above doesn't work, copy and paste the following link into your browser:</p>
                                <p><a href="${process.env.NEXT_PUBLIC_RETURN_APP_BASE}${vtoken}" style="color: #4CAF50;">${process.env.NEXT_PUBLIC_RETURN_APP_BASE}${vtoken}</a></p>
                                <p>If you didn't create an account with Divine, please ignore this email.</p>
                                <p>Best Regards,<br>The Divine Team</p>
                            </div>
                            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666666;">
                                <p>&copy; 2024 Divine. All rights reserved.</p>
                                <p>1234 Finance Lane, Money City, Economy Country</p>
                            </div>
                            </div>
                        </body>
                        </html>
                        
                        `
            })

            const activity = await activityMiddleware(req, user.id, 'Verification Email Sent', 'AUTH')
            if (activity instanceof Response) {
                return res.status(activity.status).json(activity.body); // Return the error response from middleware
            }

            messagestatus = true
        }


        const responseData = {
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
                verificationmail: messagestatus ? 'Email sent' : '',
            },
            errors: []
        };

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

module.exports = {
    testing
};
