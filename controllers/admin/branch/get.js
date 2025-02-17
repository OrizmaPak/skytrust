const { StatusCodes } = require("http-status-codes");
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware
const pg = require("../../../db/pg");
const { addOneDay } = require("../../../utils/expiredate");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getbranch = async (req, res) => {

    let userid;

    const user = req.user

    // console.log(req.user)

    // FOR PAGINATION
    const searchParams = new URLSearchParams(req.query);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
    const startdate = searchParams.get('startdate') || '';
    const enddate = searchParams.get('enddate') || '';
    const offset = (page - 1) * limit;
    const id = searchParams.get('id') || '';
    const currency = searchParams.get('currency') || '';
    const _userid = searchParams.get('_userid') || '';
    const status = searchParams.get('status') || 'ACTIVE';
    const q = searchParams.get('q') || '';
    const sort = searchParams.get('sort') || 'id';
    const order = searchParams.get('order') || 'DESC';
    const module = searchParams.get('module') || '';

    // if (req.user.role == 'SUPERADMIN') {
    //     userid = _userid || req.user.id; 
    // } else {
    //     userid = req.user.id;
    // }

    let queryString = `SELECT * FROM sky."Branch" WHERE 1=1`;
    let params = []; // Array to hold query parameters

    // Dynamically add conditions based on the presence of filters
    if (id) {
        queryString += ` AND id = $${params.length + 1}`;
        params.push(id);
    }

    if (q) {
        // Fetch column names from the 'Budget' table
        const { rows: columns } = await pg.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'Branch'
        `);

        const cols = columns.map(row => row.column_name);

        // Generate the dynamic SQL query
        const searchConditions = cols.map(col => `${col}::text ILIKE $${params.length + 1}`).join(' OR ');
        queryString += ` AND (${searchConditions})`;
        params.push(`%${q}%`);
    }

    if (status) {
        queryString += ` AND status = $${params.length + 1}`;
        params.push(status);
    }

    if (module) {
        queryString += ` AND module = $${params.length + 1}`;
        params.push(module);
    }

    if (userid) {
        queryString += ` AND userid = $${params.length + 1}`;
        params.push(userid);
    }

    if (startdate && enddate) {
        const adjustedStartdate = addOneDay(startdate);
        const adjustedEnddate = addOneDay(enddate);
        queryString += ` AND date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(adjustedStartdate, adjustedEnddate);
    } else if (startdate) {
        const adjustedStartdate = addOneDay(startdate);
        queryString += ` AND date BETWEEN $${params.length + 1} AND CURRENT_DATE + 1`;
        params.push(adjustedStartdate);
    } else if (enddate) {
        const adjustedEnddate = addOneDay(enddate);
        queryString += ` AND date <= $${params.length + 1}`;
        params.push(adjustedEnddate);
    }

    // CATCH THE QUERY TO GET THE TOTAL
    let catchquery = queryString.replace('*', 'COUNT(*)')

    // Append the ORDER BY and LIMIT clauses
    const sortParam = sort+' '+order;
    queryString += ` ORDER BY ${sortParam} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    params = params.map(param => param.toString());

    try {
        // return new Response(JSON.stringify({queryString, params, sort}))
        console.log(queryString, params)
        const { rows: branches } = await pg.query(queryString, params); // Pass params array

        // Fetch user names for each branch
        const userIds = branches.map(branch => branch.userid).filter(id => id);
        const userNamesQuery = `
            SELECT id, CONCAT(firstname, ' ', lastname, ' ', othernames) AS fullname
            FROM sky."User"
            WHERE id = ANY($1::int[])
        `;
        const { rows: userNames } = await pg.query(userNamesQuery, [userIds]);

        // Map user names to branches
        const userNameMap = userNames.reduce((acc, user) => {
            acc[user.id] = user.fullname;
            return acc;
        }, {});

        branches.forEach(branch => {
            branch.useridname = userNameMap[branch.userid] || null;
        });

        let catchparams = params.slice(0, -2)
        const { rows: [{ count: total }] } = await pg.query(catchquery, catchparams);
        const pages = divideAndRoundUp(total, limit);
        if(branches.length > 0) {
            await activityMiddleware(req, user.id, 'Branches fetched successfully', 'BRANCH'); // Tracker middleware
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "branches fetched successfully",
                statuscode: StatusCodes.OK,
                data: branches,
                pagination: {
                    total: Number(total),
                    pages, 
                    page,
                    limit
                },
                errors: []
            });
        }
        if(branches.length == 0) {
            await activityMiddleware(req, user.id, 'No Branch found', 'BRANCH'); // Tracker middleware
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "No Branch found",
                statuscode: StatusCodes.OK,
                data: '',
                errors: []  
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching branches', 'BRANCH'); // Tracker middleware
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
    getbranch
};