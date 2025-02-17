const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware for activity tracking
const pg = require("../../../db/pg"); // Import PostgreSQL database connection
const { addOneDay } = require("../../../utils/expiredate"); // Import utility function to add one day to a date
const { divideAndRoundUp } = require("../../../utils/pageCalculator"); // Import utility function for pagination

// Function to handle GET inventory request
const getInventory = async (req, res) => {

    let userid;

    // Extract user from request
    const user = req.user

    // FOR PAGINATION
    // Parse query parameters from URL
    const searchParams = new URLSearchParams(req.query);
    // Extract pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
    // Extract date range parameters
    const startdate = searchParams.get('startdate') || '';
    const enddate = searchParams.get('enddate') || '';
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    // Extract other filter parameters
    const branch = searchParams.get('branch') || '';
    const itemid = searchParams.get('itemid') || '';
    const applyto = searchParams.get('applyto') || '';
    const itemclass = searchParams.get('itemclass') || '';
    const reference = searchParams.get('reference') || '';
    const composite = searchParams.get('composite') || '';
    const compositeid = searchParams.get('compositeid') || '';
    const group = searchParams.get('group') || '';
    const maxqty = searchParams.get('maxqty') || '';
    const minqty = searchParams.get('minqty') || '';
    const status = searchParams.get('status') || 'ACTIVE';
    const sort = searchParams.get('sort') || 'id';
    const order = searchParams.get('order') || 'DESC';
    const department = searchParams.get('department') || ''; // Added department filter

    // Base query string for inventory selection
    let queryString = `SELECT * FROM sky."Inventory" WHERE 1=1`;
    let params = []; // Array to hold query parameters

    // Dynamically add conditions based on the presence of filters
    if (branch) {
        queryString += ` AND branch = $${params.length + 1}`;
        params.push(branch);
    }

    if (itemid) {
        queryString += ` AND itemid = $${params.length + 1}`;
        params.push(itemid);
    }

    if (applyto) {
        queryString += ` AND applyto = $${params.length + 1}`;
        params.push(applyto);
    }

    if (itemclass) {
        queryString += ` AND itemclass = $${params.length + 1}`;
        params.push(itemclass);
    }

    if (reference) {
        queryString += ` AND reference = $${params.length + 1}`;
        params.push(reference);
    }

    if (composite) {
        queryString += ` AND composite = $${params.length + 1}`;
        params.push(composite);
    }

    if (compositeid) {
        queryString += ` AND compositeid = $${params.length + 1}`;
        params.push(compositeid);
    }

    if (group) {
        queryString += ` AND "group" = $${params.length + 1}`;
        params.push(group);
    }

    if (maxqty && minqty) {
        queryString += ` AND qty BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(minqty, maxqty);
    } else if (maxqty) {
        queryString += ` AND qty <= $${params.length + 1}`;
        params.push(maxqty);
    } else if (minqty) {
        queryString += ` AND qty >= $${params.length + 1}`;
        params.push(minqty);
    }

    if (status) {
        queryString += ` AND status = $${params.length + 1}`;
        params.push(status);
    }

    if (startdate && enddate) {
        const adjustedStartdate = addOneDay(startdate);
        const adjustedEnddate = addOneDay(enddate);
        queryString += ` AND transactiondate BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(adjustedStartdate, adjustedEnddate);
    } else if (startdate) {
        const adjustedStartdate = addOneDay(startdate);
        queryString += ` AND transactiondate BETWEEN $${params.length + 1} AND CURRENT_DATE + 1`;
        params.push(adjustedStartdate);
    } else if (enddate) {
        const adjustedEnddate = addOneDay(enddate);
        queryString += ` AND transactiondate <= $${params.length + 1}`;
        params.push(adjustedEnddate);
    }

    // Filter by department
    if (department) {
        queryString += ` AND department = $${params.length + 1}`;
        params.push(department);
    }

    // CATCH THE QUERY TO GET THE TOTAL
    let catchquery = queryString.replace('*', 'COUNT(*)')

    // Append the ORDER BY and LIMIT clauses
    const sortParam = sort+' '+order;
    queryString += ` ORDER BY ${sortParam} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    params = params.map(param => param.toString());

    try {
        console.log(queryString, params)
        const { rows: inventory } = await pg.query(queryString, params); // Pass params array
        console.log('1st', queryString, params)
        let catchparams = params.slice(0, -2)
        const { rows: [{ count: total }] } = await pg.query(catchquery, catchparams);
        console.log('2nd', catchquery, catchparams)
        const pages = divideAndRoundUp(total, limit);
        if(inventory.length > 0) {
            // Handle unique itemid and add up qty for similar itemid
            let uniqueInventory = [];
            inventory.forEach(item => {
                let existingItem = uniqueInventory.find(i => i.itemid === item.itemid);
                if (existingItem) {
                    existingItem.qty += item.qty;
                } else {
                    uniqueInventory.push(item);
                }
            }); 
            // Fetch departmentname and branchname from their tables
            await Promise.all(uniqueInventory.map(async (item, i) => {
                const { rows: [{ department }] } = await pg.query(`SELECT department FROM sky."Department" WHERE id = $1`, [item.department]);
                const { rows: [{ branch }] } = await pg.query(`SELECT branch FROM sky."Branch" WHERE id = $1`, [item.branch]);
                uniqueInventory[i].departmentname = department;
                uniqueInventory[i].branchname = branch;
            }));
            await activityMiddleware(req, user.id, 'Inventory fetched successfully', 'INVENTORY'); // Tracker middleware
            console.log(uniqueInventory)
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Inventory fetched successfully",
                statuscode: StatusCodes.OK,
                data: uniqueInventory,
                pagination: { 
                    total: Number(uniqueInventory.length),
                    pages, 
                    page,
                    limit
                },
                errors: []
            });
        }
        if(inventory.length == 0) {
            await activityMiddleware(req, user.id, 'No Inventory found', 'INVENTORY'); // Tracker middleware
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "No Inventory found",
                statuscode: StatusCodes.OK,
                data: '',
                errors: []  
            });
        }
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
    getInventory
};

