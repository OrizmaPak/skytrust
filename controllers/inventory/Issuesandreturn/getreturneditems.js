const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware for activity tracking

const getreturneditems = async (req, res) => {
    const { startdate, enddate } = req.query;
    let query = `SELECT * FROM sky."Inventory" WHERE status = 'ACTIVE' AND transactiondesc = 'RETURNED ITEMS'`;
    let params = [];

    if (startdate && enddate) {
        query += ` AND transactiondate BETWEEN $1 AND $2`;
        params.push(startdate, enddate);
    } else if (startdate) {
        query += ` AND transactiondate >= $1`;
        params.push(startdate);
    } else if (enddate) {
        query += ` AND transactiondate <= $1`;
        params.push(enddate);
    }

    try {
        const { rows: inventory } = await pg.query(query, params);

        await activityMiddleware(req, req.user.id, 'Inventory with ISSUES retrieved successfully', 'RETURNED ITEMS'); // Tracker middleware

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Inventory with ISSUES retrieved successfully",
            statuscode: StatusCodes.OK,
            data: inventory,
            errors: []
        });
    } catch (error) {
        console.error(error);
        await activityMiddleware(req, req.user.id, 'An unexpected error occurred fetching inventory with ISSUES', 'RETURNED ITEMS'); // Tracker middleware
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

module.exports = { getreturneditems };
