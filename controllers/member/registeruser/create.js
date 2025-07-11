const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcryptjs");
const { isValidEmail } = require("../../../utils/isValidEmail");
const pg = require("../../../db/pg");
const { sendEmail } = require("../../../utils/sendEmail");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");
const { autoAddMembershipAndAccounts } = require("../../../middleware/autoaddmembershipandaccounts");

const registeruser = async (req, res) => {
    if (req.files) {
        await uploadToGoogleDrive(req, res);
    }
    const user = req.user; 
    const { firstname, lastname, email, phone, othernames = '', verify = false, device = 'registered by staff', country = '', state = '', image = '', emailverified = null, address = '', role = 'USER', permissions = null, officeaddress = '', image2 = '', gender = '', occupation = '', lga = '', town = '', maritalstatus = '', spousename = '', stateofresidence = '', lgaofresidence = '', nextofkinfullname = '', nextofkinphone = '', nextofkinrelationship = '', nextofkinaddress = '', nextofkinofficeaddress = '', nextofkinoccupation = '', dateofbirth = null, branch = 1, registrationpoint = 0, dateadded = new Date(), lastupdated = null, status = 'ACTIVE', createdby = user.id??0, id = null } = req.body;
    console.log({ firstname, lastname, email, othernames, ema: isValidEmail(email) });


    // if (user.registrationpoint == 0 || user.role == 'MEMBER') {
    //     return res.status(StatusCodes.FORBIDDEN).json({
    //         status: false,
    //         message: "You are not permitted to register or update a user. You must be registered to a registration point as a staff member.",
    //         statuscode: StatusCodes.FORBIDDEN,
    //         data: null,
    //         errors: []
    //     });
    // } 

    // Basic validation
    if (!firstname || !lastname || !email || !isValidEmail(email)) { 
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
        const { rows: theuser } = await pg.query(`SELECT * FROM skyeu."User" WHERE email = $1`, [email]);

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
        if (theuser.length > 0 && !id) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Email already in use",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Check if the branch exists
        const { rows: branchExists } = await pg.query(`SELECT * FROM skyeu."Branch" WHERE id = $1`, [branch]);
        if (branchExists.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Branch does not exist",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }
 
        // Hash the password
        const hashedPassword = await bcrypt.hash(phone, 10);

        // If id is provided, update the user
        if (id) {
            // Check if the user exists and the phone matches
            const { rows: existingUser } = await pg.query(`SELECT * FROM skyeu."User" WHERE id = $1`, [id]);
            if (existingUser.length === 0) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `User with id ${id} not found`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
            if (existingUser[0].phone !== phone) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Phone number does not match the existing record for user with id ${id}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            const { rows: updatedUser } = await pg.query(`UPDATE skyeu."User" SET 
            firstname = COALESCE($1, firstname), lastname = COALESCE($2, lastname), othernames = COALESCE($3, othernames), email = COALESCE($4, email), password = COALESCE($5, password), role = COALESCE($6, role), permissions = COALESCE($7, permissions), country = COALESCE($8, country), state = COALESCE($9, state), phone = COALESCE($10, phone), emailverified = COALESCE($11, emailverified), address = COALESCE($12, address), officeaddress = COALESCE($13, officeaddress), image = COALESCE(NULLIF($14, ''), image), image2 = COALESCE(NULLIF($15, ''), image2), gender = COALESCE($16, gender), occupation = COALESCE($17, occupation), lga = COALESCE($18, lga), town = COALESCE($19, town), maritalstatus = COALESCE($20, maritalstatus), spousename = COALESCE($21, spousename), stateofresidence = COALESCE($22, stateofresidence), lgaofresidence = COALESCE($23, lgaofresidence), nextofkinfullname = COALESCE($24, nextofkinfullname), nextofkinphone = COALESCE($25, nextofkinphone), nextofkinrelationship = COALESCE($26, nextofkinrelationship), nextofkinaddress = COALESCE($27, nextofkinaddress), nextofkinofficeaddress = COALESCE($28, nextofkinofficeaddress), nextofkinoccupation = COALESCE($29, nextofkinoccupation), dateofbirth = COALESCE($30, dateofbirth), branch = COALESCE($31, branch), registrationpoint = COALESCE($32, registrationpoint), dateadded = COALESCE($33, dateadded), lastupdated = COALESCE($34, lastupdated), status = COALESCE($35, status), createdby = COALESCE($36, createdby) WHERE id = $37 RETURNING *`, 
            [firstname, lastname, othernames, email, hashedPassword, role, permissions, country, state, phone, emailverified, address, officeaddress, image, image2, gender, occupation, lga, town, maritalstatus, spousename, stateofresidence, lgaofresidence, nextofkinfullname, nextofkinphone, nextofkinrelationship, nextofkinaddress, nextofkinofficeaddress, nextofkinoccupation, dateofbirth, branch, registrationpoint, dateadded, lastupdated, "ACTIVE", createdby, id]);
            if (updatedUser.length > 0) {
                return res.status(StatusCodes.OK).json({
                    status: true,
                    message: `User ${firstname} ${lastname} updated successfully`,
                    statuscode: StatusCodes.OK,
                    data: updatedUser,
                    errors: []
                });
            } else {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `User with id ${id} not found`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        } else {
            // Insert new user using raw query to avoid SQL injection attacks and other vulnerabilities 
            const { rows: [saveuser] } = await pg.query(`INSERT INTO skyeu."User" 
            (firstname, lastname, othernames, email, password, role, permissions, country, state, phone, emailverified, address, officeaddress, image, image2, gender, occupation, lga, town, maritalstatus, spousename, stateofresidence, lgaofresidence, nextofkinfullname, nextofkinphone, nextofkinrelationship, nextofkinaddress, nextofkinofficeaddress, nextofkinoccupation, dateofbirth, branch, registrationpoint, dateadded, lastupdated, status, createdby) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36) RETURNING id`, [firstname, lastname, othernames, email, hashedPassword, role, permissions, country, state, phone, null, address, officeaddress, image, image2, gender, occupation, lga, town, maritalstatus, spousename, stateofresidence, lgaofresidence, nextofkinfullname, nextofkinphone, nextofkinrelationship, nextofkinaddress, nextofkinofficeaddress, nextofkinoccupation, dateofbirth, branch, registrationpoint, dateadded, lastupdated, status, createdby]);
            const userId = saveuser.id;
            console.log(saveuser);
            const user = saveuser;
                req.newuser = saveuser
            let accountaction = await autoAddMembershipAndAccounts(req, res)

            // send welcome email
            await sendEmail({
                to: email,
                subject: 'Welcome to Sky Trust! 🎉',
                text: 'Your journey to financial freedom begins now.',
                html: `<!DOCTYPE html>
                  <html lang="en">
                  <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Welcome to Sky Trust!</title>
                  </head>
                  <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                      <div style="background-color: #4CAF50; padding: 20px; text-align: center; color: #ffffff;">
                        <h1 style="margin: 0;">Welcome to Sky Trust! 🎉</h1>
                      </div>
                      <div style="padding: 20px;">
                        <p style="font-size: 16px; color: #333333;">Hi <strong>${firstname}</strong>,</p>
                        <p style="font-size: 16px; color: #333333;">Welcome to <strong>Sky Trust Multi-Purpose Cooperative Society</strong>! We're excited to have you join our cooperative on the path to <strong>financial freedom</strong>.</p>
                        <h2 style="color: #4CAF50;">What’s Next?</h2>
                        <ul style="font-size: 16px; color: #333333; padding-left: 20px;">
                          <li>Login: <p style="color: red;font-weight: bold">Login with your email and user your registered phone number as password</p></li>
                          <li>Empower Your Finances: Join a community of farmers and members working together towards prosperity.</li>
                          <li>Set and Achieve Goals: Benefit from savings plans, loans, and financial growth strategies tailored for you.</li>
                          <li>Monitor Your Progress: Track your contributions, loan status, and more through detailed reports.</li>
                        </ul>
                        <h2 style="color: #4CAF50;">Get Started</h2>
                        <ol style="font-size: 16px; color: #333333; padding-left: 20px;">
                          <li><a href="#" style="color: #4CAF50; text-decoration: none;">Log in to your account</a> using the email you registered with: [User's Email].</li>
                          <li>Update your profile and financial preferences.</li>
                          <li>Start your journey towards financial empowerment with us!</li>
                        </ol>
                        <p style="font-size: 16px; color: #333333;">If you have any questions or need assistance, feel free to reach out to our support team at <a href="mailto:support@divinehelp.com" style="color: #4CAF50; text-decoration: none;">support@divinehelp.com</a>.</p>
                        <p style="font-size: 16px; color: #333333;">Thank you for choosing Sky Trust Cooperative. We’re here to help you reach your financial goals and achieve lasting success!</p>
                      </div>
                      <div style="background-color: #f4f4f4; padding: 20px; text-align: center;">
                        <p style="font-size: 12px; color: #666666;">&copy; 2024 Sky Trust Multi-Purpose Cooperative Society. All rights reserved.</p>
                      </div>
                    </div>
                  </body>
                  </html>
                `
            });

            const responseData = {
                status: accountaction,
                message: accountaction ? `Congratulations!! you have successfully registered ${firstname} ${lastname} under you` : 'Something went wrong with creating memberships and other accounts, please contact support',
                statuscode: accountaction ? StatusCodes.OK : StatusCodes.BAD_REQUEST,
                data: null,
                errors: accountaction ? [] : ['Membership and account creation failed']
            };

            if (saveuser > 0) {
                return res.status(StatusCodes.OK).json(responseData);
            } else {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Something went wrong!! User not registered cross check the information and save again`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }
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
    registeruser
};