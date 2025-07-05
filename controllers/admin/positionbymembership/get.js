const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { addOneDay } = require("../../../utils/expiredate");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getdefinedmembershipposition = async (req, res) => {
  try {
    let query = {
      text: `SELECT p.*, b.branch AS branchname, m.member AS membername, 
             CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS useridname 
             FROM sky."Position" p 
             LEFT JOIN sky."Branch" b ON p.branch = b.id 
             LEFT JOIN sky."DefineMember" m ON p.member = m.id 
             LEFT JOIN sky."User" u ON p.userid = u.id
             WHERE 1=1`, // Make sure we start with WHERE 1=1 here
      values: []
    };

    // Dynamically build the WHERE clause based on query parameters
    let whereClause = '';
    let valueIndex = 1;
    Object.keys(req.query).forEach((key) => {
      // If the key isn't 'q', we treat it as a column filter
      if (key !== 'q' && key !== 'startdate' && key !== 'enddate' && key !== 'page' && key !== 'limit' && key !== 'sort' && key !== 'order') {
        whereClause += ` AND p."${key}"::text = $${valueIndex}::text`;
        query.values.push(req.query[key]);
        valueIndex++;
      }
    });

    // Add search query if provided
    if (req.query.q) {
      // Fetch column names from the 'Position' table
      const { rows: columns } = await pg.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'sky' AND table_name = 'Position'
      `);

      const cols = columns.map(row => row.column_name);

      // Generate the dynamic SQL query
      const searchConditions = cols
        .map(col => `p.${col}::text ILIKE $${valueIndex}`)
        .join(' OR ');
      whereClause += ` AND (${searchConditions})`;
      query.values.push(`%${req.query.q}%`);
      valueIndex++;
    }

    // Add startdate and enddate
    const startdate = req.query.startdate || '';
    const enddate = req.query.enddate || '';
    if (startdate && enddate) {
      const adjustedStartdate = addOneDay(startdate);
      const adjustedEnddate = addOneDay(enddate);
      whereClause += ` AND p.date BETWEEN $${valueIndex} AND $${valueIndex + 1}`;
      query.values.push(adjustedStartdate, adjustedEnddate);
      valueIndex += 2;
    } else if (startdate) {
      const adjustedStartdate = addOneDay(startdate);
      whereClause += ` AND p.date >= $${valueIndex}`;
      query.values.push(adjustedStartdate);
      valueIndex++;
    } else if (enddate) {
      const adjustedEnddate = addOneDay(enddate);
      whereClause += ` AND p.date <= $${valueIndex}`;
      query.values.push(adjustedEnddate);
      valueIndex++;
    }

    // Append the whereClause to the main query
    query.text += whereClause;

    // Add pagination, sorting, and ordering
    const searchParams = new URLSearchParams(req.query);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
    const offset = (page - 1) * limit;

    query.text += ` ORDER BY p.${req.query.sort || 'id'} ${req.query.order || 'DESC'} LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    query.values.push(limit, offset);

    // Execute the main query
    const result = await pg.query(query);
    const positions = result.rows;

    // Get total count for pagination
    // NOTE the crucial fix: we prefix with "WHERE 1=1" before appending the same whereClause
    const countQuery = {
      text: `SELECT COUNT(*) FROM sky."Position" p WHERE 1=1 ${whereClause}`,
      values: query.values.slice(0, -2) // Exclude limit and offset
    };

    console.log(countQuery); // For debugging, you can remove this later if desired

    const { rows: [{ count: total }] } = await pg.query(countQuery);
    const pages = divideAndRoundUp(total, limit);

    return res.status(StatusCodes.OK).json({
      status: true,
      message: positions.length > 0
        ? "Organization Membership fetched successfully"
        : "No Member found",
      statuscode: StatusCodes.OK,
      data: positions,
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
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "An unexpected error occurred",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [error.message]
    });
  }
};

module.exports = {
  getdefinedmembershipposition
};  
