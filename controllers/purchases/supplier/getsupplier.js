const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware for activity tracking

const getSupplier = async (req, res) => {
  const { query } = req;
  let queryStr = `SELECT * FROM skyeu."Supplier"`;
  let params = [];
  let whereClause = '';
  let valueIndex = 1;

  Object.keys(query).forEach((key) => {
    if (key !== 'q') {
      if (whereClause) {
        whereClause += ` AND `;
      } else {
        whereClause += ` WHERE `;
      }
      whereClause += `"${key}" = $${valueIndex}`;
      params.push(query[key]);
      valueIndex++;
    }
  });

  if (query.q) {
    const { rows: columns } = await pg.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'sky' AND table_name = 'Supplier'
    `);

    const cols = columns.map(row => row.column_name);
    const searchConditions = cols.map(col => `${col}::text ILIKE $${valueIndex}`).join(' OR ');

    if (whereClause) {
      whereClause += ` AND (${searchConditions})`;
    } else {
      whereClause += ` WHERE (${searchConditions})`;
    }
    params.push(`%${query.q}%`);
    valueIndex++;
  }

  queryStr += whereClause;

  try {
    const { rows: suppliers } = await pg.query(queryStr, params);
    await activityMiddleware(req, req.user.id, 'Supplier retrieved successfully', 'SUPPLIER'); // Tracker middleware
    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Supplier retrieved successfully",
      statuscode: StatusCodes.OK,
      data: suppliers,
      errors: []
    });
  } catch (error) {
    console.error(error);
    await activityMiddleware(req, req.user.id, 'An unexpected error occurred fetching supplier', 'SUPPLIER'); // Tracker middleware
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "Internal Server Error",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: []
    });
  }
};

module.exports = { getSupplier };
