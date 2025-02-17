const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getStockLedger = async (req, res) => {
    try { 
        // Destructure the request query
        const { itemid, startdate, enddate, branch, department } = req.query;

        // Validate the presence of itemid, startdate, and enddate
        if (!itemid || !startdate || !enddate) {
            await activityMiddleware(res, req.user.id, 'Missing compulsory itemid, startdate, or enddate', 'GET STOCK LEDGER');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Itemid, startdate, and enddate are required for getting stock ledger",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Itemid, startdate, and enddate are required for getting stock ledger"]
            });
        }

        // Fetch inventory based on the filters
        const { rows: inventory } = await pg.query(`SELECT * FROM sky."Inventory" WHERE itemid = $1 AND transactiondate >= $2 AND transactiondate <= $3 AND status = 'ACTIVE' AND qty != 0 ${branch ? `AND branch = '${branch}'` : ''} ${department ? `AND department = '${department}'` : ''}`, [itemid, startdate, enddate]);

        // Fetch branch names for the inventory items
        const branchIds = inventory.map(item => item.branch);
        const { rows: branchNames } = await pg.query(`SELECT id, branch FROM sky."Branch" WHERE id = ANY($1::int[])`, [branchIds]);

        // Create a map of branch IDs to branch names
        const branchNameMap = branchNames.reduce((map, branch) => {
            map[branch.id] = branch.branch;
            return map;
        }, {});

        // Fetch department names for the inventory items
        const departmentIds = inventory.map(item => item.department);
        const { rows: departmentNames } = await pg.query(`SELECT id, department FROM sky."Department" WHERE id = ANY($1::int[])`, [departmentIds]);

        // Create a map of department IDs to department names
        const departmentNameMap = departmentNames.reduce((map, department) => {
            map[department.id] = department.department;
            return map;
        }, {});

        // Add branchname and departmentname to each inventory item
        const inventoryWithNames = inventory.map(item => ({
            ...item,
            branchname: branchNameMap[item.branch] || 'Unknown',
            departmentname: departmentNameMap[item.department] || 'Unknown'
        }));

        // Compressed query to calculate balance brought in, out, forward, and forward cost
        const compressedQuery = `SELECT 
                                   SUM(CASE WHEN qty > 0 THEN qty ELSE 0 END) AS balanceBroughtIn,
                                   SUM(CASE WHEN qty < 0 THEN qty ELSE 0 END) AS balanceBroughtOut,
                                   SUM(qty) AS balanceBroughtForward,
                                   MAX(CASE WHEN transactiondate < $2 THEN cost ELSE NULL END) AS balanceBroughtForwardCost
                                FROM sky."Inventory"
                                WHERE itemid = $1 AND transactiondate < $2 AND status = 'ACTIVE' ${branch ? `AND branch = ${branch}` : ''} ${department ? `AND department = '${department}'` : ''}`;
        const balances = await pg.query(compressedQuery, [itemid, startdate]);

        // Extract values from the compressed query result
        const balanceBroughtIn = balances.rows[0].balancebroughtin ?? 0;
        const balanceBroughtOut = balances.rows[0].balancebroughtout ?? 0;
        const balanceBroughtForward = balances.rows[0].balancebroughtforward ?? 0;
        const balanceBroughtForwardCost = balances.rows[0].balancebroughtforwardcost ?? 0;

        // Add balance brought in, out, forward, and forward cost to the result
        const result = {
            balanceBroughtIn,
            balanceBroughtOut,
            balanceBroughtForward,
            balanceBroughtForwardCost,
            items: inventoryWithNames
        };

        // Log activity
        await activityMiddleware(res, req.user.id, `Stock ledger fetched successfully for item ${itemid}`, 'GET STOCK LEDGER');

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Stock ledger fetched successfully",
            statuscode: StatusCodes.OK,
            data: result,
            errors: []
        });
    } catch (error) {
        // Log and return error response
        console.error(error);
        await activityMiddleware(res, req.user.id, 'An unexpected error occurred while fetching stock ledger', 'GET STOCK LEDGER');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

// Export the getStockLedger function
module.exports = { getStockLedger };
