const { StatusCodes } = require("http-status-codes");
const { activityMiddleware } = require("../../../middleware/activity");
const pg = require("../../../db/pg");

const getAccounts = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `SELECT * FROM sky."Accounts"`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = '';
        let valueIndex = 1;
        if (req.query.q) {
            const searchValue = `%${req.query.q}%`;
            whereClause += ` WHERE "accountnumber" ILIKE $${valueIndex} OR "groupname" ILIKE $${valueIndex} OR "accounttype" ILIKE $${valueIndex} OR "description" ILIKE $${valueIndex}`;
            query.values.push(searchValue);
            valueIndex++;
        } else {
            Object.keys(req.query).forEach((key, index) => {
                if (whereClause) {
                    whereClause += ` AND `;
                } else {
                    whereClause += ` WHERE `;
                }
                whereClause += `"${key}" = $${valueIndex}`;
                query.values.push(req.query[key]);
                valueIndex++;
            });
        }

        query.text += whereClause;

        const result = await pg.query(query);
        const accounts = result.rows;

        await activityMiddleware(req, user.id, 'Accounts fetched successfully', 'ACCOUNT');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Accounts fetched successfully",
            statuscode: StatusCodes.OK,
            data: accounts, 
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching accounts', 'ACCOUNT');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getAccounts };
