const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getLoanProducts = async (req, res) => {
  const user = req.user;

  try {
    const {
      // Extract possible query parameters
      q,                 // search term
      page = "1",        // page number (default "1")
      limit = process.env.DEFAULT_LIMIT, // results per page
      ...filters         // other filter fields from req.query
    } = req.query;

    // Convert pagination params to integers
    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);

    // ============ STEP 1: Build base query for loan products ============
    const query = {
      text: `
        SELECT 
          lp.*,
          CASE 
            WHEN lp.membership IS NOT NULL THEN
              CASE 
                WHEN lp.membership ~ '^[0-9]+$' THEN
                  (SELECT dm.member FROM sky."DefineMember" dm WHERE dm.id = lp.membership::int)
                ELSE
                  (SELECT string_agg(dm.member, '||') 
                   FROM sky."DefineMember" dm 
                   WHERE dm.id = ANY(string_to_array(lp.membership, '||')::int[]))
              END
            ELSE NULL
          END AS membershipnames
        FROM sky."loanproduct" lp
      `,
      values: [],
    };

    // ============ STEP 2: Collect WHERE conditions from filters ============
    const whereClauses = [];
    let valueIndex = 1;

    // For each filter (besides 'q'), push a condition
    for (const [key, value] of Object.entries(filters)) {
      if (key !== "q") {
        whereClauses.push(`"${key}" = $${valueIndex}`);
        query.values.push(value);
        valueIndex++;
      }
    }

    // If we have at least one condition, add it to the query
    if (whereClauses.length > 0) {
      query.text += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    // ============ STEP 3: Add search functionality ============
    if (q) {
      // Grab all columns from the "loanproduct" table
      // so we can do a dynamic OR-based search across them
      const { rows: columns } = await pg.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'sky' AND table_name = 'loanproduct'
      `);

      // Build up an array of "column_name ILIKE" expressions
      const searchConditions = columns
        .map(
          (row) => `${row.column_name}::text ILIKE $${valueIndex}`
        )
        .join(" OR ");

      // If we already have at least one WHERE condition, chain with AND
      const prefix = whereClauses.length > 0 ? " AND" : " WHERE";

      query.text += `${prefix} (${searchConditions})`;
      query.values.push(`%${q}%`);
      valueIndex++;
    }

    // ============ STEP 4: Add pagination (LIMIT/OFFSET) ============
    query.text += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    query.values.push(pageSize, (pageNum - 1) * pageSize);

    // ============ STEP 5: Execute the main query ============
    const { rows: loanProducts } = await pg.query(query);

    // ============ STEP 6: Fetch penalty details (if any) ============
    const penaltyIds = loanProducts
      .map((product) => product.defaultpenaltyid)
      .filter(Boolean);

    const penaltyDetails = {};

    if (penaltyIds.length > 0) {
      const penaltyQuery = {
        text: `SELECT * FROM sky."loanfee" WHERE id = ANY($1::int[])`,
        values: [penaltyIds],
      };
      const { rows: penaltyRows } = await pg.query(penaltyQuery);
      penaltyRows.forEach((row) => {
        penaltyDetails[row.id] = row;
      });
    }

    // Attach penalty details to each product
    loanProducts.forEach((product) => {
      product.penaltyDetails = penaltyDetails[product.defaultpenaltyid] || null;
    });

    // ============ STEP 7: Get total count for pagination ============
    // Build a separate count query (reuses same WHERE logic but no LIMIT/OFFSET)
    const countQuery = {
      text: `
        SELECT COUNT(*) 
        FROM sky."loanproduct"
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
        ${q ? (whereClauses.length > 0 ? " AND" : " WHERE") : ""}
      `,
      values: query.values.slice(0, -2), // exclude the last two (LIMIT, OFFSET)
    };

    if (q) {
      // The last value in 'values' for the main query is the q's '%searchTerm%',
      // but we also need to exclude LIMIT & OFFSET.
      // The final array item (after excluding limit & offset) is the search term, so it stays.
      // Just be sure not to re-append them.
      // Adjust the query to append the search condition again:
      const searchConditionAfterWhere = columns
        .map(
          (row) => `${row.column_name}::text ILIKE $${countQuery.values.length + 1}`
        )
        .join(" OR ");

      countQuery.text += `(${searchConditionAfterWhere})`;
      countQuery.values.push(`%${q}%`);
    }

    const {
      rows: [{ count: total }],
    } = await pg.query(countQuery);

    // Calculate total pages
    const pages = divideAndRoundUp(total, pageSize);

    // ============ STEP 8: Log activity and return data ============
    await activityMiddleware(
      req,
      user.id,
      "Loan products fetched successfully",
      "LOAN_PRODUCT"
    );

    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Loan products fetched successfully",
      statuscode: StatusCodes.OK,
      data: loanProducts,
      pagination: {
        total: Number(total),
        pages,
        page: pageNum,
        limit: pageSize,
      },
      errors: [],
    });
  } catch (error) {
    console.error("Unexpected Error:", error);
    await activityMiddleware(
      req,
      user.id,
      "An unexpected error occurred fetching loan products",
      "LOAN_PRODUCT"
    );

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "An unexpected error occurred",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [error.message],
    });
  }
};

module.exports = { getLoanProducts };
