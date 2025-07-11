const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware for activity tracking

const getissuelog = async (req, res) => {
    const { startdate, enddate, branch, department, status = "ACTIVE" } = req.query;
    let query = `
        SELECT Inventory.*, Branch.branch AS branchname, Department.department AS departmentname, Issue.issuetype AS issuetypename
        FROM skyeu."Inventory" AS Inventory
        JOIN skyeu."Branch" AS Branch ON Inventory.branch::int = Branch.id
        JOIN skyeu."Department" AS Department ON Inventory.department::int = Department.id
        JOIN skyeu."issue" AS Issue ON Inventory.issuetype::int = Issue.id
        WHERE Inventory.transactiondesc LIKE '%Issue%'
    `;
    let params = [];
 
    if (startdate && enddate) {
        query += ` AND Inventory.transactiondate BETWEEN $1 AND $2`;
        params.push(startdate, enddate);
    } else if (startdate) {
        query += ` AND Inventory.transactiondate >= $1`;
        params.push(startdate);
    } else if (enddate) { 
        query += ` AND Inventory.transactiondate <= $1`; 
        params.push(enddate);
    }

    if (branch) {
        query += ` AND Inventory.branch = $${params.length + 1}`;
        params.push(branch);
    }

    if (department) {
        query += ` AND Inventory.department = $${params.length + 1}`;
        params.push(department);
    }

    if (status) {
        query += ` AND Inventory.status = $${params.length + 1}`;
        params.push(status);
    }

    try {
        const { rows: inventory } = await pg.query(query, params);
        console.log(query)

        await activityMiddleware(req, req.user.id, 'Inventory with ISSUES retrieved successfully', 'ISSUE_LOG'); // Tracker middleware

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Inventory with ISSUES retrieved successfully",
            statuscode: StatusCodes.OK,
            data: inventory,
            errors: []
        });
    } catch (error) {
        console.error(error);
        await activityMiddleware(req, req.user.id, 'An unexpected error occurred fetching inventory with ISSUES', 'ISSUE_LOG'); // Tracker middleware
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

module.exports = { getissuelog };
