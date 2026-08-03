const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcrypt");
const { isValidEmail } = require("../../utils/isValidEmail");
const pg = require("../../db/pg");
const jwt = require("jsonwebtoken");
const { calculateExpiryDate, isPastDate } = require("../../utils/expiredate");
const { sendEmail } = require("../../utils/sendEmail");
const { authMiddleware } = require("../../middleware/authentication");
const { activityMiddleware } = require("../../middleware/activity");
const { uploadToGoogleDrive } = require("../../utils/uploadToGoogleDrive");
const { hasPermission } = require("../../utils/permissions");

async function updateuser(req, res) {
    if (req.files) {
        await uploadToGoogleDrive(req, res);
    }
    const {
        _userid = '',
        firstname,
        lastname,
        othernames,
        image,
        image2,
        country,
        state,
        emailverified,
        address,
        officeaddress,
        role,
        permissions,
        userpermissions,
        password,
        gender,
        occupation,
        lga,
        town,
        maritalstatus,
        spousename,
        stateofresidence,
        lgaofresidence,
        nextofkinfullname,
        nextofkinphone,
        nextofkinrelationship,
        nextofkinaddress,
        nextofkinofficeaddress,
        nextofkinoccupation,
        dateofbirth,
        branch,
        registrationpoint,
        status,
        id,
        email
    } = req.body;

    const user = req.user;
    let userid;

    // For status-only updates (e.g., soft delete)
    if (status) {
        if (id) {
            userid = id;
        } else if (_userid) {
            userid = _userid;
        } else {
            userid = user.id;
        }
    } else if (id) {
        userid = id;
    } else if (_userid) {
        userid = _userid;
    } else {
        userid = user.id;
    }

    console.log('req.body', req.body);

    try {  
        const isPermissionUpdate = role !== undefined || permissions !== undefined || userpermissions !== undefined;
        if (isPermissionUpdate && !hasPermission(user, 'ACCESS CONTROL')) {
            return res.status(StatusCodes.FORBIDDEN).json({
                status: false,
                message: "You are not authorized to update roles or permissions",
                statuscode: StatusCodes.FORBIDDEN,
                data: null,
                errors: []
            });
        }

        if (status) {
            await pg.query(
                `UPDATE skytobi."User" 
                 SET status = $1, 
                     lastupdated = $2
                 WHERE id = $3`,
                [status, new Date(), userid]
            );
        } else if (id) {
            await pg.query(
                `UPDATE skytobi."User" 
                 SET firstname = COALESCE($1, firstname), 
                     lastname = COALESCE($2, lastname), 
                     othernames = COALESCE($3, othernames), 
                     image = COALESCE(NULLIF($4, ''), image),
                     image2 = COALESCE(NULLIF($5, ''), image2),
                     role = COALESCE($6, role),
                     lastupdated = $7,
                     state = COALESCE($8, state),
                     country = COALESCE($9, country),
                     address = COALESCE($10, address),
                     officeaddress = COALESCE($11, officeaddress),
                     branch = COALESCE($12, branch),
                     permissions = COALESCE($13, permissions),
                     userpermissions = COALESCE($14, userpermissions), 
                     gender = COALESCE($15, gender),
                     occupation = COALESCE($16, occupation),
                     lga = COALESCE($17, lga),
                     town = COALESCE($18, town),
                     maritalstatus = COALESCE($19, maritalstatus),
                     spousename = COALESCE($20, spousename),
                     stateofresidence = COALESCE($21, stateofresidence),
                     lgaofresidence = COALESCE($22, lgaofresidence),
                     nextofkinfullname = COALESCE($23, nextofkinfullname),
                     nextofkinphone = COALESCE($24, nextofkinphone),
                     nextofkinrelationship = COALESCE($25, nextofkinrelationship),
                     nextofkinaddress = COALESCE($26, nextofkinaddress),
                     nextofkinofficeaddress = COALESCE($27, nextofkinofficeaddress),
                     nextofkinoccupation = COALESCE($28, nextofkinoccupation),
                     dateofbirth = COALESCE($29, dateofbirth),
                     registrationpoint = COALESCE($30, registrationpoint)
                 WHERE id = $31`,
                [
                    firstname, lastname, othernames, image, image2, role, new Date(), state, country, address, officeaddress, branch, permissions, userpermissions, gender, occupation, lga, town, maritalstatus, spousename, stateofresidence, lgaofresidence, nextofkinfullname, nextofkinphone, nextofkinrelationship, nextofkinaddress, nextofkinofficeaddress, nextofkinoccupation, dateofbirth, registrationpoint, id
                ]
            );
        } else if (!id && email) {
            await pg.query(
                `UPDATE skytobi."User" 
                 SET firstname = COALESCE($1, firstname), 
                     lastname = COALESCE($2, lastname), 
                     othernames = COALESCE($3, othernames), 
                     image = COALESCE(NULLIF($4, ''), image),
                     image2 = COALESCE(NULLIF($5, ''), image2),
                     role = COALESCE($6, role),
                     lastupdated = $7,
                     state = COALESCE($8, state),
                     country = COALESCE($9, country),
                     address = COALESCE($10, address),
                     officeaddress = COALESCE($11, officeaddress),
                     permissions = COALESCE($12, permissions),
                     userpermissions = COALESCE($13, userpermissions),
                     gender = COALESCE($14, gender),
                     occupation = COALESCE($15, occupation),
                     lga = COALESCE($16, lga),
                     town = COALESCE($17, town),
                     maritalstatus = COALESCE($18, maritalstatus),
                     spousename = COALESCE($19, spousename),
                     stateofresidence = COALESCE($20, stateofresidence),
                     lgaofresidence = COALESCE($21, lgaofresidence),
                     nextofkinfullname = COALESCE($22, nextofkinfullname),
                     nextofkinphone = COALESCE($23, nextofkinphone),
                     nextofkinrelationship = COALESCE($24, nextofkinrelationship),
                     nextofkinaddress = COALESCE($25, nextofkinaddress),
                     nextofkinofficeaddress = COALESCE($26, nextofkinofficeaddress),
                     nextofkinoccupation = COALESCE($27, nextofkinoccupation),
                     dateofbirth = COALESCE($28, dateofbirth),
                     registrationpoint = COALESCE($29, registrationpoint)
                 WHERE email = $30`,
                [
                    firstname, lastname, othernames, image, image2, role, new Date(), state, country, address, officeaddress, permissions, userpermissions, gender, occupation, lga, town, maritalstatus, spousename, stateofresidence, lgaofresidence, nextofkinfullname, nextofkinphone, nextofkinrelationship, nextofkinaddress, nextofkinofficeaddress, nextofkinoccupation, dateofbirth, registrationpoint, email
                ]
            );
        }
        await activityMiddleware(req, user.id, `Updated Profile`, 'AUTH');

        const updatedUser = email && !id && !_userid
            ? await pg.query(`SELECT * FROM skytobi."User" WHERE email = $1`, [email])
            : await pg.query(`SELECT * FROM skytobi."User" WHERE id = $1`, [userid]);

        const { password: _password, ...userWithoutPassword } = updatedUser.rows[0] || {};
        return res.status(StatusCodes.OK).json({
            status: true,
            message: 'Profile Update Successful',
            statuscode: StatusCodes.OK,
            data: userWithoutPassword,
            errors: []
        });

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

module.exports = { updateuser }
