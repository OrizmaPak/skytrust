const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getHistory = async (req, res) => {
    const user = req.user;
    const { userid } = req.query;

    if (!userid) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "User ID is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["User ID is required"]
        });
    }

    try {
        // Fetch user data, level, allowances, and deductions
        const userQuery = {
            text: `SELECT u.*, l.level as levelname
                   FROM skyeu."User" u
                   LEFT JOIN skyeu."level" l ON u.level = l.id
                   WHERE u.id = $1`,
            values: [userid]
        };
        const userResult = await pg.query(userQuery);
        const userData = userResult.rows[0];  

        if (!userData) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "User not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["User not found"]
            });
        }

        // Fetch related data
        const tables = ['guarantor', 'employmentrecord', 'referee', 'qualification', 'parentguardians', 'query', 'promotiondemotion', 'terminationresignation', 'suspension', 'leave', 'warning', 'monitoringevaluation', 'level'];
        const promises = tables.map(table => {
            let query;
            if (table === 'level') {
                query = {
                    text: `SELECT l.*, 
                                  (SELECT json_agg(a) FROM skyeu."allowances" a WHERE a.level = l.id AND a.status = 'ACTIVE') as allowances,
                                  (SELECT json_agg(d) FROM skyeu."deductions" d WHERE d.level = l.id AND d.status = 'ACTIVE') as deductions
                           FROM skyeu."level" l
                           WHERE l.id = $1 AND l.status = 'ACTIVE'`,
                    values: [userData.level]
                };
            } else {
                query = {
                    text: `SELECT * FROM skyeu."${table}" WHERE userid = $1 AND status = 'ACTIVE'`,
                    values: [userid]
                };
            }
            return pg.query(query);
        });

        const results = await Promise.all(promises);
        const data = {};
        tables.forEach((table, index) => {
            data[table] = results[index].rows;
        });

        await activityMiddleware(req, user.id, 'User history fetched successfully', 'HISTORY');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "User history fetched successfully",
            statuscode: StatusCodes.OK,
            data: {
                user: userData,
                ...data
            },
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching user history', 'HISTORY');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getHistory };
