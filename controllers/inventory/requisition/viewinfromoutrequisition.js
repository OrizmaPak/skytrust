const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware for activity tracking
const pg = require("../../../db/pg"); // Import PostgreSQL database connection
const { addOneDay } = require("../../../utils/expiredate"); // Import utility function to add one day to a date
const { divideAndRoundUp } = require("../../../utils/pageCalculator"); // Import utility function for pagination

// Function to handle GET inventory request
const viewinfromoutrequisition = async (req, res) => {

    let userid;

    // Extract user from request
    const user = req.user

    // FOR PAGINATION
    // Parse query parameters from URL
    const searchParams = new URLSearchParams(req.query);
    // Extract pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    // Extract other filter parameters
    const branch = searchParams.get('branch') || '';
    const department = searchParams.get('department') || ''; // Added department filter
    const status = searchParams.get('status') || ''; // Added status filter
    const startdate = searchParams.get('startdate') || null; // Added start date filter
    const enddate = searchParams.get('enddate') || null; // Added end date filter

    // Base query string for inventory selection
    let queryString = `SELECT * FROM skyeu."Inventory" WHERE transactiondesc LIKE '%Requisition%'`;
    let params = []; // Array to hold query parameters

    // Dynamically add conditions based on the presence of filters
    // if (branch) {
    //     queryString += ` AND branch = $${params.length + 1}`;
    //     params.push(branch);
    // }

    // if (department) {
    //     queryString += ` AND department = $${params.length + 1}`;
    //     params.push(department);
    // }

    // Add date range filter for transactiondate
    if (startdate && enddate) {
        queryString += ` AND transactiondate BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(startdate, enddate);
    } else if (startdate) {
        queryString += ` AND transactiondate >= $${params.length + 1}`;
        params.push(startdate);
    } else if (enddate) {
        queryString += ` AND transactiondate <= $${params.length + 1}`;
        params.push(enddate);
    }

    // Append the ORDER BY and LIMIT clauses
    const sortParam = 'id DESC'; // Default sort order
    queryString += ` ORDER BY ${sortParam} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    params = params.map(param => param.toString());

    try {
        console.log(queryString, params)
        const { rows: inventory } = await pg.query(queryString, params); // Pass params array
        let uniqueInventory = [];
        let batches = {}; // Object to hold batches of references

        // Process each inventory item
        for (const item of inventory) {
            console.log('item:', item);
            // Check if the reference is already in the batches object
            if (!batches[item.reference]) {
                batches[item.reference] = { 
                    branchfrom: '', branchfromname: '', 
                    branchto: '', branchtoname: '', 
                    departmentfrom: '', departmentfromname: '', 
                    departmentto: '', departmenttoname: '', reference: '',
                    items: [],
                    outitems: []
                };
            }

            // Determine if the item is part of a batch based on qty
            if (item.qty < 0) {
                // Filter out references where the inventory with negative qty has status of PENDING REQUISITION
                if (item.status === 'PENDING REQUISITION') {
                    delete batches[item.reference];
                    continue;
                }
                batches[item.reference].reference = item.reference;
                batches[item.reference].branchfrom = item.branch;
                batches[item.reference].departmentfrom = item.department;
                // Fetch branch and department names
                // batches[item.reference].outitems.push({
                //     itemid: item.itemid, 
                //     itemname: item.itemname,
                //     units: item.units,
                //     qty: item.qty, 
                //     price: item.price,
                //     cost: item.cost,
                //     sellingprice: item.sellingprice,  
                //     status: item.status
                // });
                const { rows: [{ branch: branchfromname }] } = await pg.query(`SELECT branch FROM skyeu."Branch" WHERE id = $1`, [item.branch]);
                const { rows: [{ department: departmentfromname }] } = await pg.query(`SELECT department FROM skyeu."Department" WHERE id = $1`, [item.department]);
                batches[item.reference].branchfromname = branchfromname;
                batches[item.reference].departmentfromname = departmentfromname;
            } else {
                batches[item.reference].reference = item.reference;
                batches[item.reference].branchto = item.branch;
                batches[item.reference].departmentto = item.department;
                batches[item.reference].transactiondate = item.transactiondate;
                batches[item.reference].status = item.status;
                batches[item.reference].items.push({
                    itemid: item.itemid,
                    itemname: item.itemname,
                    units: item.units,
                    qty: item.qty, 
                    price: item.price,
                    cost: item.cost,
                    sellingprice: item.sellingprice,  
                    status: item.status
                });
                // Fetch branch and department names
                const { rows: [{ branch: branchtoname }] } = await pg.query(`SELECT branch FROM skyeu."Branch" WHERE id = $1`, [item.branch]);
                const { rows: [{ department: departmenttoname }] } = await pg.query(`SELECT department FROM skyeu."Department" WHERE id = $1`, [item.department]);
                batches[item.reference].branchtoname = branchtoname;
                batches[item.reference].departmenttoname = departmenttoname;
            }
        }
        
        // Convert batches object to an array of batches
        uniqueInventory = Object.values(batches);

        await activityMiddleware(req, user.id, 'Inventory fetched successfully', 'INVENTORY'); // Tracker middleware
        console.log(uniqueInventory)
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Inventory fetched successfully",
            statuscode: StatusCodes.OK,
            data: uniqueInventory.filter(item => (!branch || item.branchto == branch)).filter(item => (!department || item.departmentto == department)),
            pagination: { 
                total: Number(uniqueInventory.length),
                pages: divideAndRoundUp(uniqueInventory.length, limit),
                page,
                limit
            },
            errors: [] 
        });
    } catch (err) {
        console.error('Unexpected Error:', err);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching inventory', 'INVENTORY'); // Tracker middleware
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
    viewinfromoutrequisition
};

