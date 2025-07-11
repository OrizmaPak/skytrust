const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

// Array of month names for display
const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER"
];

const getUserYearlyCollection = async (req, res) => {
  const user = req.user;
  const { date, userid } = req.query;

  // 1) Validate input
  if (!date || !userid) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: false,
      message: "Date and userid are required",
      statuscode: StatusCodes.BAD_REQUEST,
      data: null,
      errors: ["Missing date or userid"],
    });
  }

  const year = Number(date);
  if (!year || year < 1000 || year > 9999) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: false,
      message: "Invalid date format. Expected YYYY",
      statuscode: StatusCodes.BAD_REQUEST,
      data: null,
      errors: ["Invalid date format"],
    });
  }

  // 2) Prepare accumulators for grand totals
  let totalNoOfCollections = 0;
  let totalAmountCollected = 0;
  let totalRemitted = 0;
  let totalExcess = 0;
  let totalToBalance = 0;
  let totalPenalty = 0;

  // 3) Initialize an array of 12 months with zero values
  //    So you'll always get a record for each month, even if empty
  const monthlyData = MONTH_NAMES.map((monthName, idx) => ({
    month: monthName,      // "JANUARY", "FEBRUARY", etc.
    noofcollections: 0,
    amountcollected: 0,
    remitted: 0,
    excess: 0,
    tobalance: 0,
    penalty: 0
  }));

  try {
    // 4) Fetch default_cash_account
    const orgSettingsQuery = `SELECT default_cash_account FROM skyeu."Organisationsettings"`;
    const { rows: orgSettings } = await pg.query(orgSettingsQuery);
    const defaultCashAccount = orgSettings[0].default_cash_account;

    // 5) Build date range for the full year
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));   // e.g. 2023-01-01T00:00:00Z
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)); // e.g. 2024-01-01T00:00:00Z

    // 6) Fetch all transactions matching the filters
    const yearDataQuery = `
      SELECT *
      FROM skyeu."transaction"
      WHERE userid = $1
        AND transactiondate >= $2
        AND transactiondate < $3
        AND "cashref" IS NOT NULL
        AND "cashref" <> ''
        AND ttype IN ('CREDIT', 'DEBIT')
        AND status = 'ACTIVE'
        AND accountnumber != $4
    `;
    const yearDataResult = await pg.query(yearDataQuery, [
      userid,
      yearStart.toISOString(),
      yearEnd.toISOString(),
      defaultCashAccount,
    ]);
    const yearData = yearDataResult.rows;

    // 7) Iterate month by month, day by day
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      // daysInMonth for the current month in this year
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        // Build a date string in UTC
        const currentDate = new Date(Date.UTC(year, monthIndex, day));
        // YYYY, MM (2-digit), DD (2-digit)
        const yearStr = currentDate.getUTCFullYear();
        const monthStr = String(currentDate.getUTCMonth() + 1).padStart(2, "0");
        const dayStr = String(currentDate.getUTCDate()).padStart(2, "0");

        // e.g. "20230107"
        const dateString = `${yearStr}${monthStr}${dayStr}`;
        // e.g. "CR-20230107-123"
        const cashRefPrefix = `CR-${dateString}-${userid}`;

        // Filter transactions for that day
        const dayData = yearData.filter((tx) =>
          tx.cashref.startsWith(cashRefPrefix)
        );

        if (dayData.length === 0) {
          continue; // No transactions for this day
        }

        // Calculate # of credit tx and sum of credits
        const creditTransactions = dayData.filter((tx) => tx.ttype === "CREDIT");
        const noofcollections = creditTransactions.length;
        const amountcollected = creditTransactions.reduce(
          (sum, tx) => sum + (tx.credit || 0),
          0
        );

        // Calculate sum of debits
        const debitSum = dayData
          .filter((tx) => tx.ttype === "DEBIT")
          .reduce((sum, tx) => sum + (tx.debit || 0), 0);

        // Calculate remitted
        const transactionRefs = dayData.map((tx) => tx.cashref).filter(Boolean);
        let remitted = 0;
        if (transactionRefs.length > 0) {
          const bankTxQuery = `
            SELECT credit, debit 
            FROM skyeu."banktransaction"
            WHERE transactionref = ANY($1) AND status = 'ACTIVE'
          `;
          const bankTxResult = await pg.query(bankTxQuery, [transactionRefs]);
          const bankTransactions = bankTxResult.rows;

          const bankTxSum = bankTransactions.reduce(
            (sum, btx) => sum + ((btx.credit || 0) - (btx.debit || 0)),
            0
          );
          remitted = bankTxSum ;
        }

        // Calculate penalty
        const penaltyRefs = transactionRefs.map((ref) => `${ref}-P`);
        let penaltySum = 0;
        if (penaltyRefs.length > 0) {
          const penaltyQuery = `
            SELECT debit, credit 
            FROM skyeu."transaction"
            WHERE cashref = ANY($1) AND status = 'ACTIVE'
          `;
          const penaltyResult = await pg.query(penaltyQuery, [penaltyRefs]);
          const penaltyTransactions = penaltyResult.rows;

          penaltySum = penaltyTransactions.reduce(
            (sum, ptx) => sum + ((ptx.debit || 0) - (ptx.credit || 0)),
            0
          );
        }

        // net => excess or tobalance
        const net = amountcollected - remitted;
        let excess = 0;
        let tobalance = 0;
        if (net > 0) {
          tobalance = net;
        } else {
          excess = Math.abs(net);
        }

        // Update monthly aggregator
        monthlyData[monthIndex].noofcollections += noofcollections;
        monthlyData[monthIndex].amountcollected += amountcollected;
        monthlyData[monthIndex].remitted += remitted;
        monthlyData[monthIndex].excess += excess;
        monthlyData[monthIndex].tobalance += tobalance;
        monthlyData[monthIndex].penalty += penaltySum;

        // Update overall totals
        totalNoOfCollections += noofcollections;
        totalAmountCollected += amountcollected;
        totalRemitted += remitted;
        totalExcess += excess;
        totalToBalance += tobalance;
        totalPenalty += penaltySum;
      }
    }

    // 8) Build a totals object
    const totals = {
      totalNoOfCollections,
      totalAmountCollected,
      totalRemitted,
      totalExcess,
      totalToBalance,
      totalPenalty,
    };

    // 9) Activity logging
    await activityMiddleware(
      req,
      user.id,
      "User yearly collection (all months) fetched successfully",
      "USER_YEARLY_COLLECTION"
    );

    // 10) Return
    return res.status(StatusCodes.OK).json({
      status: true,
      message: "User yearly collection fetched successfully (all months)",
      statuscode: StatusCodes.OK,
      data: monthlyData, // array of 12 objects (JAN..DEC)
      totals,
      errors: [],
    });
  } catch (error) {
    console.error("Error fetching user yearly collection:", error);
    await activityMiddleware(
      req,
      user.id,
      "An unexpected error occurred fetching user yearly collection",
      "USER_YEARLY_COLLECTION"
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

module.exports = { getUserYearlyCollection };
