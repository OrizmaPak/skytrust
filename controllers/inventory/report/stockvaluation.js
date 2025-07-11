const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

const getStockValuation = async (req, res) => {
    try {
        // Destructure the request query
        const { date, branch, department } = req.query;

        // Validate the presence of date
        if (!date) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Date is required for stock valuation",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Date is required for stock valuation"]
            });
        }

        // Validate the presence of branch if department is provided
        // if (department && !branch) {
        //     return res.status(StatusCodes.BAD_REQUEST).json({
        //         status: false,
        //         message: "Branch is required if department is provided",
        //         statuscode: StatusCodes.BAD_REQUEST,
        //         data: null,
        //         errors: ["Branch is required if department is provided"]
        //     });
        // }

        // Fetch all inventories for the given date
        let query = `SELECT * FROM skyeu."Inventory" WHERE transactiondate <= $1 AND status = 'ACTIVE'`;
        const params = [date];
        if (branch) {
            query += ` AND branch = $${params.length + 1}`;
            params.push(branch);
        }
        if (department) {
            query += ` AND department = $${params.length + 1}`;
            params.push(department);
        }
        const { rows: inventories } = await pg.query(query, params);

        // Group inventories by itemid and calculate balance
        const groupedInventories = inventories.reduce((acc, current) => {
            const { itemid, itemname, cost, qty } = current;
            if (!acc[itemid]) {
                acc[itemid] = { itemid, itemname, cost: 0, qty: 0, balance: 0 };
            }
            acc[itemid].cost = Math.max(acc[itemid].cost, cost);
            acc[itemid].qty += qty;
            acc[itemid].balance = acc[itemid].cost * acc[itemid].qty;
            return acc;
        }, {});

        // Convert the grouped object to an array of objects
        const result = Object.values(groupedInventories).map(({ itemid, itemname, cost, qty, balance }) => ({
            itemid,
            itemname,
            cost,
            qty,
            balance
        }));

        // Calculate total qty and total balance
        const totalQty = result.reduce((acc, current) => acc + current.qty, 0);
        const totalCost = result.reduce((acc, current) => acc + current.cost, 0);
        const totalBalance = result.reduce((acc, current) => acc + current.balance, 0);

         // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Stock valuation fetched successfully",
            statuscode: StatusCodes.OK,
            data: { items: result, totalQty, totalBalance, date, totalCost },
            errors: []
        });
    } catch (error) {
        // Log and return error response
        console.error(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error", 
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}; 

// Export the getStockValuation function
module.exports = { getStockValuation };