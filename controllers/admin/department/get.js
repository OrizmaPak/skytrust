const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const pg = require("../../../db/pg"); // Import PostgreSQL client
const { divideAndRoundUp } = require("../../../utils/pageCalculator"); // Import utility for pagination calculations

// Function to handle GET request for departments
const getDepartment = async (req, res) => {
    try {
        // Extract parameters from the request query
        const searchParams = new URLSearchParams(req.query);
        const page = parseInt(searchParams.get('page') || '1', 10); // Current page number
        const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10); // Number of items per page
        const branch = searchParams.get('branch') || ''; // Filter by branch
        const status = searchParams.get('status') || 'ACTIVE'; // Filter by status
        const q = searchParams.get('q') || ''; // Search query
        const sort = searchParams.get('sort') || 'id'; // Sorting field
        const order = searchParams.get('order') || 'DESC'; // Sorting order
        const id = searchParams.get('id'); // Filter by id
        const userid = searchParams.get('userid'); // Filter by userid
        const offset = (page - 1) * limit; // Calculate offset for pagination

        let queryString = `
            SELECT d.*, b.branch AS branchname, CONCAT(u.firstname, ' ', u.lastname) AS useridname
            FROM sky."Department" d
            LEFT JOIN sky."Branch" b ON d.branch = b.id
            LEFT JOIN sky."User" u ON d.userid = u.id
            WHERE 1=1
        `; // Base query string with joins for branch and user names
        let params = []; // Array to hold query parameters

        // Dynamically add conditions based on the presence of filters
        if (id) {
            queryString += ` AND d."id" = $${params.length + 1}`;
            params.push(id);
        } else {
            if (q) {
                // Fetch column names from the 'Department' table to dynamically generate search conditions
                const { rows: columns } = await pg.query(`
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'sky' AND table_name = 'Department' AND table_schema = 'divine'
                `);

                const cols = columns.map(row => row.column_name);

                if (cols.length === 0) {
                    throw new Error("No columns found for Department table.");
                }

                // Generate the dynamic SQL query for search with correct parameter indexing
                const searchConditions = cols.map(col => {
                    params.push(`%${q}%`); // Push a separate parameter for each column
                    return `d."${col}"::text ILIKE $${params.length}`;
                }).join(' OR ');

                queryString += ` AND (${searchConditions})`;
            }

            if (branch) {
                // Add condition for branch filter
                queryString += ` AND d."branch" = $${params.length + 1}`;
                params.push(branch);
            }

            if (status) {
                // Add condition for status filter
                queryString += ` AND d."status" = $${params.length + 1}`;
                params.push(status);
            }

            if (userid) {
                // Add condition for userid filter
                queryString += ` AND d."userid" = $${params.length + 1}`;
                params.push(userid);
            }

            // Define valid sort fields and map them to their qualified names
            const validSortFields = {
                'id': 'd."id"',
                'department': 'd."department"',
                'branch': 'b."branch"',
                'status': 'd."status"',
                // Add other sortable fields as necessary
            };

            // Validate and set sort field
            const sortField = validSortFields[sort] || 'd."id"';

            // Validate and set sort order
            const validOrder = ['ASC', 'DESC'];
            const sortOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

            // Combine sort parameters
            const sortParam = `${sortField} ${sortOrder}`;

            // Append the ORDER BY and LIMIT clauses to the query string
            queryString += ` ORDER BY ${sortParam} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);
        }

        console.log(queryString, params); // Log the query string and parameters for debugging
        const { rows: departments } = await pg.query(queryString, params); // Execute the query with parameters

        // Prepare parameters for the count query
        let countQuery = `SELECT COUNT(*) FROM sky."Department" d WHERE 1=1`;
        let countParams = [];
        if (branch) {
            countQuery += ` AND d."branch" = $${countParams.length + 1}`;
            countParams.push(branch);
        }
        if (status) {
            countQuery += ` AND d."status" = $${countParams.length + 1}`;
            countParams.push(status);
        }
        if (userid) {
            countQuery += ` AND d."userid" = $${countParams.length + 1}`;
            countParams.push(userid);
        }

        const { rows: [{ count: total }] } = await pg.query(countQuery, countParams);
        const pages = divideAndRoundUp(total, limit); // Calculate total pages

        if (departments.length > 0) {
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Departments fetched successfully",
                statuscode: StatusCodes.OK,
                data: departments,
                pagination: {
                    total: Number(total),
                    pages,
                    page,
                    limit
                },
                errors: []
            });
        } else {
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "No Departments found",
                statuscode: StatusCodes.OK,
                data: '',
                errors: []
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err); // Log any unexpected errors
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
    getDepartment
};
