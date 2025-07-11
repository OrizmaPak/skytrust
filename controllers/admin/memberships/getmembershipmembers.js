const { StatusCodes } = require("http-status-codes");
const { activityMiddleware } = require("../../../middleware/activity");
const pg = require("../../../db/pg");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getMembershipMembers = async (req, res) => {
    const user = req.user;


    try {
        let query = {
            text: `SELECT m.*, 
                    dm.member AS membername, 
                    CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS useridname,
                    p.position AS position,
                    p.branch AS positionbranch,
                    ub.branch AS userbranchname,
                    pb.branch AS positionbranchname,
                    row_to_json(u) AS user
                    FROM skyeu."Membership" m
                   LEFT JOIN skyeu."DefineMember" dm ON m.member = dm.id
                   LEFT JOIN skyeu."User" u ON m.userid = u.id
                   LEFT JOIN skyeu."Position" p ON m.member = p.member AND m.userid = p.userid
                   LEFT JOIN skyeu."Branch" ub ON u.branch = ub.id
                   LEFT JOIN skyeu."Branch" pb ON p.branch = pb.id`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = '';
        let valueIndex = 1;
        Object.keys(req.query).forEach((key) => {
            if (key !== 'q' && key !== 'startdate' && key !== 'enddate' && key !== 'branch' && req.query[key] !== '') { // Exclude startdate, enddate, and branch
                if (whereClause) {
                    whereClause += ` AND `;
                } else {
                    whereClause += ` WHERE `; 
                }
                whereClause += `m."${key}" = $${valueIndex}`;
                query.values.push(req.query[key]);
                valueIndex++;
            }
        });

        // Add date range filter if startdate and enddate are provided
        if (req.query.startdate || req.query.enddate) {
            if (whereClause) {
                whereClause += ` AND `;
            } else {
                whereClause += ` WHERE `;
            }
            if (req.query.startdate) {
                whereClause += `m.dateadded >= $${valueIndex}`;
                query.values.push(req.query.startdate);
                valueIndex++;
            }
            if (req.query.enddate) {
                if (req.query.startdate) {
                    whereClause += ` AND `;
                }
                whereClause += `m.dateadded <= $${valueIndex}`;
                query.values.push(req.query.enddate);
                valueIndex++;
            }
        }

        // Add search query if provided
        if (req.query.q) {
            // Fetch column names from the 'Membership' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'sky' AND table_name = 'Membership'
            `);

            const cols = columns.map(row => row.column_name);

            // Generate the dynamic SQL query
            const searchConditions = cols.map(col => `m.${col}::text ILIKE $${valueIndex}`).join(' OR ');
            if (whereClause) {
                whereClause += ` AND (${searchConditions})`;
            } else {
                whereClause += ` WHERE (${searchConditions})`;
            }
            query.values.push(`%${req.query.q}%`);
            valueIndex++;
        }

        query.text += whereClause;

        // Add pagination
        const searchParams = new URLSearchParams(req.query);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
        const offset = (page - 1) * limit;

        query.text += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
        query.values.push(limit, offset);

        const result = await pg.query(query);
        let memberships;
        if(req.query.branch)memberships = result.rows.filter(data =>data.user.branch == req.query.branch)
            else memberships = result.rows;

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM skyeu."Membership" m ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = divideAndRoundUp(total, limit); 

        await activityMiddleware(req, user.id, 'Memberships fetched successfully', 'MEMBERSHIP');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Memberships fetched successfully",
            statuscode: StatusCodes.OK,
            data: memberships,
            pagination: {
                total: Number(total),
                pages,
                page,
                limit
            },
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching memberships', 'MEMBERSHIP');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getMembershipMembers };