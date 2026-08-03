const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const pg = require('../db/pg');
const { manageOnlineUser } = require('./onlinestatus');
const { resolveEffectivePermissions } = require('../utils/permissions');

const authMiddleware = async (req, res, next) => {
  // CHECK IF THE HEADER HAS A TOKEN
  const token = req.headers['authorization']?.split(' ')[1];

  // IF THE TOKEN DOES NOT EXIST
  if (!token) {
    const errors = [{ field: '', message: 'Token not found' }];
    return res.status(StatusCodes.UNAUTHORIZED).json({
      status: false,
      message: 'Unauthorized access',
      statuscode: StatusCodes.UNAUTHORIZED,
      data: null,
      errors: errors
    });
  }

  try {
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // CHECK IF THE SESSION IS IN THE SERVER
    const { rows: [user] } = await pg.query(`SELECT * FROM skytobi."Session" WHERE sessiontoken = $1`, [token]);

    // CHECK IF THE SESSION TIME IS EXPIRED
    if (user && user.sessiontoken === token && user.expires > new Date()) {
      const { rows: [loggedinuser] } = await pg.query(`SELECT * FROM skytobi."User" WHERE id = $1`, [user.userid]);
      // CHECK IF USER IS AN ACTIVE USER
      if (loggedinuser.status != 'ACTIVE') {
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: false,
          message: `Your account has been ${loggedinuser.status}`,
          statuscode: StatusCodes.BAD_REQUEST,
          data: null,
          errors: []
        });
      }
      const { password, ...withoutpassword } = loggedinuser;
      const { rows: [role] } = await pg.query(
        `SELECT permissions FROM skytobi."Roles" WHERE role = $1 AND status = $2`,
        [withoutpassword.role, 'ACTIVE']
      );
      withoutpassword.rolepermissions = role?.permissions || withoutpassword.permissions;
      withoutpassword.permissions = resolveEffectivePermissions(withoutpassword, withoutpassword.rolepermissions);
      // ATTACH USER TO REQUEST OBJECT
      req.user = withoutpassword;

      // Automatically call manageOnlineUser middleware
      await manageOnlineUser(req, res, async () => {
        next();
      });
    } else {
      // IF THE SESSION IS EXPIRED DELETE THE SESSION FROM THE SERVER
      if (user && user.sessiontoken === token) {
        await pg.query(`DELETE FROM skytobi."Session" WHERE sessiontoken = $1`, [token]);
      }
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: false,
        message: 'Expired Session',
        statuscode: StatusCodes.UNAUTHORIZED,
        data: null,
        errors: []
      });
    }
  } catch (err) {
    console.error('Unexpected Error:', err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: 'An unexpected error occurred',
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [{ field: '', message: err.message }]
    });
  }
};

module.exports = authMiddleware;
