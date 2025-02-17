const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getTransactionsAndBalance = async (req, res) => {
  const user = req.user;

  try {
    // Parse query params:
    //   page, limit -> for pagination (on "view" data)
    //   userid -> optional filter by user ID
    //   branch -> optional filter by branch
    const {
      page = 1,
      limit = process.env.DEFAULT_LIMIT || 10,
      userid,
      branch,
    } = req.query;

    const pageInt = parseInt(page, 10) || 1;
    const limitInt = parseInt(limit, 10) || 10;
    const offset = (pageInt - 1) * limitInt;

    // -----------------------------------------------------------------------
    // 1. Fetch organization settings
    // -----------------------------------------------------------------------
    const orgSettingsQuery = `SELECT * FROM sky."Organisationsettings"`;
    const orgSettingsResult = await pg.query(orgSettingsQuery);

    if (orgSettingsResult.rows.length === 0) {
      await activityMiddleware(
        req,
        user.id,
        "Organization settings not found",
        "EXPENDITURE_ALLOCATION"
      );
      return res.status(StatusCodes.NOT_FOUND).json({
        status: false,
        message: "Organization settings not found",
        statuscode: StatusCodes.NOT_FOUND,
        data: null,
        errors: [],
      });
    }

    const orgSettings = orgSettingsResult.rows[0];
    const allocationAccountNumber = orgSettings.default_allocation_account;

    // -----------------------------------------------------------------------
    // 2. Build dynamic WHERE clauses & values for the "view" data
    //    (Group by userid, but only sum ACTIVE transactions into balance)
    // -----------------------------------------------------------------------
    //
    // We do a JOIN to "User" so we can filter by branch if provided.
    //
    // E.g. if the user has:
    //   ?userid=U123&branch=HQ
    // We'll only return transactions for user "U123" whose branch is "HQ".
    //
    // Implementation Steps:
    //   1) We'll accumulate conditions in an array, then .join(" AND ").
    //   2) We'll accumulate query parameter values in an array in the correct order.
    //   3) We'll pass these into the query.
    //
    // For the final "LIMIT" and "OFFSET", we add them at the end.

    const conditionsView = [
      `t.accountnumber = $1`, // $1 -> allocationAccountNumber
    ];
    const valuesView = [allocationAccountNumber];

    let paramIndex = 2;

    // Optional filter by userid
    if (userid) {
      conditionsView.push(`t.userid = $${paramIndex}`);
      valuesView.push(userid);
      paramIndex++;
    }

    // Optional filter by branch
    if (branch) {
      // We do "u.branch = $x"
      // because we need to join with user table for the branch
      conditionsView.push(`u.branch = $${paramIndex}`);
      valuesView.push(branch);
      paramIndex++;
    }

    // We'll push limit and offset as well
    const limitParamIndex = paramIndex;
    const offsetParamIndex = paramIndex + 1;

    valuesView.push(limitInt, offset);

    // "view" query (grouped by userid)
    // - We join "User" so we can filter by branch
    // - We only sum "ACTIVE" rows for the balance
    // - We still JSON_AGG all rows into "transactions"
    const transactionsQuery = `
      SELECT 
        sub.userid,
        SUM(
          CASE WHEN sub.status = 'ACTIVE' THEN sub.credit ELSE 0 END
        ) 
        - SUM(
          CASE WHEN sub.status = 'ACTIVE' THEN sub.debit ELSE 0 END
        ) AS balance,
        JSON_AGG(row_to_json(sub)) AS transactions
      FROM (
        SELECT t.*
        FROM sky."transaction" t
        JOIN sky."User" u ON t.userid = u.id
        WHERE ${conditionsView.join(" AND ")}
      ) AS sub
      GROUP BY sub.userid
      ORDER BY sub.userid
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    // -----------------------------------------------------------------------
    // 3. Execute the "view" query
    // -----------------------------------------------------------------------
    const transactionsResult = await pg.query(transactionsQuery, valuesView);

    // -----------------------------------------------------------------------
    // 4. Build dynamic WHERE for "notactive" data
    //    (Flat list, status <> 'ACTIVE', optional filters by userid & branch)
    // -----------------------------------------------------------------------
    const conditionsNotActive = [
      `t.accountnumber = $1`,
      `t.status <> 'ACTIVE'`,
    ];
    const valuesNotActive = [allocationAccountNumber];

    let paramIndexNA = 2;

    // Optional filter by userid
    if (userid) {
      conditionsNotActive.push(`t.userid = $${paramIndexNA}`);
      valuesNotActive.push(userid);
      paramIndexNA++;
    }

    // Optional filter by branch
    if (branch) {
      conditionsNotActive.push(`u.branch = $${paramIndexNA}`);
      valuesNotActive.push(branch);
      paramIndexNA++;
    }

    const notActiveQuery = `
      SELECT
        t.*,
        CASE 
          WHEN u.id IS NOT NULL 
          THEN (
            u.firstname || ' ' || COALESCE(u.othernames, '') || ' ' || u.lastname
          )
          ELSE 'Unknown User'
        END AS fullname,
        CASE 
          WHEN cu.id IS NOT NULL 
          THEN (
            cu.firstname || ' ' || COALESCE(cu.othernames, '') || ' ' || cu.lastname
          )
          ELSE 'Unknown User'
        END AS createdbyname
      FROM sky."transaction" t
      LEFT JOIN sky."User" u ON t.userid = u.id
      LEFT JOIN sky."User" cu ON t.createdby = cu.id
      WHERE ${conditionsNotActive.join(" AND ")}
      ORDER BY t.dateadded DESC
    `;

    const notActiveResult = await pg.query(notActiveQuery, valuesNotActive);

    // -----------------------------------------------------------------------
    // 5. Build user name map for the "view" data
    //    (We already have "fullname" in "notactive" from the LEFT JOIN)
    // -----------------------------------------------------------------------
    const userIdsView = transactionsResult.rows.map((row) => row.userid);

    let userNamesMap = {};
    if (userIdsView.length > 0) {
      // We only need user names for the user IDs that showed up in "view"
      // (the "notactive" data already has them from the join)
      //
      // Also, we might apply branch filter, but
      // typically you'd only get those user IDs who are in the correct branch anyway.
      //
      // For simplicity, we won't re-check branch here, but if you want, you can add that filter.
      const userNamesQuery = `
        SELECT id, firstname, lastname, othernames
        FROM sky."User"
        WHERE id = ANY($1)
      `;
      const userNamesResult = await pg.query(userNamesQuery, [userIdsView]);

      userNamesMap = userNamesResult.rows.reduce((acc, row) => {
        const fullName = `${row.firstname} ${
          row.othernames ? row.othernames + " " : ""
        }${row.lastname}`;
        acc[row.id] = fullName.trim();
        return acc;
      }, {});
    }

    // -----------------------------------------------------------------------
    // 6. Construct "view" data (grouped array)
    // -----------------------------------------------------------------------
    const viewData = transactionsResult.rows.map((row) => ({
      userid: row.userid,
      fullname: userNamesMap[row.userid] || "Unknown User",
      balance: row.balance,
      transactions: row.transactions || [],
    }));

    // -----------------------------------------------------------------------
    // 7. Construct "notactive" data (flat array)
    // -----------------------------------------------------------------------
    const notActiveData = notActiveResult.rows.map((row) => ({
      ...row,
      fullname: row.fullname?.trim() || "Unknown User",
    }));

    // -----------------------------------------------------------------------
    // 8. Count distinct user IDs (for pagination of "view")
    //    Use the same join + conditions if we want to reflect the same filter
    // -----------------------------------------------------------------------
    const conditionsCount = [`t.accountnumber = $1`];
    const valuesCount = [allocationAccountNumber];

    let paramIndexCount = 2;

    if (userid) {
      conditionsCount.push(`t.userid = $${paramIndexCount}`);
      valuesCount.push(userid);
      paramIndexCount++;
    }

    if (branch) {
      conditionsCount.push(`u.branch = $${paramIndexCount}`);
      valuesCount.push(branch);
      paramIndexCount++;
    }

    const totalCountQuery = `
      SELECT COUNT(DISTINCT t.userid) AS total_count
      FROM sky."transaction" t
      JOIN sky."User" u ON t.userid = u.id
      WHERE ${conditionsCount.join(" AND ")}
    `;

    const totalCountResult = await pg.query(totalCountQuery, valuesCount);
    const totalCount = parseInt(totalCountResult.rows[0].total_count, 10) || 0;
    const totalPages = Math.ceil(totalCount / limitInt);

    // -----------------------------------------------------------------------
    // 9. Return the JSON response
    // -----------------------------------------------------------------------
    await activityMiddleware(
      req,
      user.id,
      "Transactions and balances fetched successfully",
      "EXPENDITURE_ALLOCATION"
    );

    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Transactions and balances fetched successfully",
      statuscode: StatusCodes.OK,
      data: {
        view: viewData,        // grouped by userid
        notactive: notActiveData, // flat list
      },
      pagination: {
        total: totalCount,
        pages: totalPages,
        page: pageInt,
        limit: limitInt,
      },
      errors: [],
    });
  } catch (error) {
    console.error("Error fetching transactions and balances:", error);
    await activityMiddleware(
      req,
      user.id,
      "Error fetching transactions and balances",
      "EXPENDITURE_ALLOCATION"
    );
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "Internal Server Error",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [error.message],
    });
  }
};

module.exports = getTransactionsAndBalance;
