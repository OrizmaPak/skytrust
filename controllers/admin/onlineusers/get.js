const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getOnlineUsers = async (req, res) => {
  try {
    const { q, userid, branch } = req.query;
    const user = req.user;
    let params = [];
    let queryString = `
      SELECT 
        l.userid,
        l.date,
        CASE 
          WHEN l.date > NOW() - INTERVAL '30 minutes' THEN 'ONLINE'
          WHEN l.date > NOW() - INTERVAL '1 hour' THEN 'AWAY'
          ELSE 'OFFLINE'
        END AS online_status,
        CONCAT(u.firstname, ' ', u.lastname, ' ', u.othernames) AS fullname,
        u.email,
        u.role,
        u.branch,
        b.branch AS branchname,
        u.phone,
        u.address,
        u.createdby,
        CONCAT(u2.firstname, ' ', u2.lastname, ' ', u2.othernames) AS createdby_fullname,
        CASE 
          WHEN NOW() - l.date <= INTERVAL '1 minute' THEN 'just now'
          WHEN NOW() - l.date <= INTERVAL '1 hour' THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - l.date)) / 60) || ' minutes ago'
          WHEN NOW() - l.date <= INTERVAL '24 hours' THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - l.date)) / 3600) || ' hours ago'
          WHEN NOW() - l.date <= INTERVAL '48 hours' THEN 'yesterday'
          WHEN NOW() - l.date <= INTERVAL '30 days' THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - l.date)) / 86400) || ' days ago'
          WHEN NOW() - l.date <= INTERVAL '1 year' THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - l.date)) / 2592000) || ' months ago'
          ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - l.date)) / 31536000) || ' years ago'
        END AS time_ago
      FROM 
        sky."Lastseen" l
      LEFT JOIN 
        sky."User" u ON l.userid = u.id
      LEFT JOIN 
        sky."User" u2 ON u.createdby = u2.id
      LEFT JOIN 
        sky."Branch" b ON u.branch = b.id
      WHERE 
        l.date > NOW() - INTERVAL '1 hour'
    `;

    // Determine access level based on user role and permissions
    if (user.role !== 'SUPERADMIN' && (!user.permissions || !user.permissions.includes('CHANGE BRANCH'))) {
      // Restrict to users from the same branch
      queryString += ` AND u.branch = $${params.length + 1}`;
      params.push(user.branch);
    }

    // Refine search conditions
    if (q) {
      queryString += `
        AND (
          u.firstname ~* $${params.length + 1} 
          OR u.lastname ~* $${params.length + 2} 
          OR u.othernames ~* $${params.length + 3} 
          OR u.email ~* $${params.length + 4} 
          OR u.phone ~* $${params.length + 5}
          OR u.country ~* $${params.length + 6}
          OR u.state ~* $${params.length + 7}
          OR u.address ~* $${params.length + 8}
          OR u.role ~* $${params.length + 9}
          OR u.permissions ~* $${params.length + 10}
          OR u.officeaddress ~* $${params.length + 11}
          OR u.image2 ~* $${params.length + 12}
          OR u.gender ~* $${params.length + 13}
          OR u.occupation ~* $${params.length + 14}
          OR u.lga ~* $${params.length + 15}
          OR u.town ~* $${params.length + 16}
          OR u.maritalstatus ~* $${params.length + 17}
          OR u.spousename ~* $${params.length + 18}
          OR u.stateofresidence ~* $${params.length + 19}
          OR u.lgaofresidence ~* $${params.length + 20}
          OR u.nextofkinfullname ~* $${params.length + 21}
          OR u.nextofkinphone ~* $${params.length + 22}
          OR u.nextofkinrelationship ~* $${params.length + 23}
          OR u.nextofkinaddress ~* $${params.length + 24}
          OR u.nextofkinofficeaddress ~* $${params.length + 25}
          OR u.nextofkinoccupation ~* $${params.length + 26}
        )
      `;
      params.push(
        q, q, q, q, q, q, q, q, q, q, 
        q, q, q, q, q, q, q, q, q, q, 
        q, q, q, q, q, q
      );
    }

    // Apply additional filters for userid and branch
    if (userid) {
      queryString += ` AND l.userid = $${params.length + 1}`;
      params.push(userid);
    }

    if (branch) {
      queryString += ` AND u.branch = $${params.length + 1}`;
      params.push(branch);
    }

    // Execute query
    const { rows: onlineUsers } = await pg.query(queryString, params);

    // Calculate the online count
    const onlineCount = onlineUsers.filter(user => user.online_status === 'ONLINE').length;

    // Log activity
    await activityMiddleware(req, req.user.id, 'Online users fetched successfully', 'ONLINE_USERS');

    // Return response
    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Online users fetched successfully",
      statuscode: StatusCodes.OK,
      data: {
        onlineUsers,
        onlineCount,
      },
      errors: [],
    });

  } catch (err) {
    console.error('Unexpected Error:', err);
    await activityMiddleware(req, req.user.id, 'An unexpected error occurred fetching online users', 'ONLINE_USERS');
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "An unexpected error occurred",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [],
    });
  }
};

module.exports = {
  getOnlineUsers,
};
