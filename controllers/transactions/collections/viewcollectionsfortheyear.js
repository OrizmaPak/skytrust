const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

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

const viewCollectionsForTheYear = async (req, res) => {
  const user = req.user;
  const { date, userid, branch, registrationpoint } = req.query;

  // Validate input
  if (!date) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: false,
      message: "Date is required",
      statuscode: StatusCodes.BAD_REQUEST,
      data: null,
      errors: ["Missing date"]
    });
  }

  const year = Number(date);
  if (!year || year < 1000 || year > 9999) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: false,
      message: "Invalid date format. Expected YYYY",
      statuscode: StatusCodes.BAD_REQUEST,
      data: null,
      errors: ["Invalid date format"]
    });
  }

  // Initialize accumulators
  let totalNoOfCollections = 0;
  let totalAmountCollected = 0;
  let totalRemitted = 0;
  let totalExcess = 0;
  let totalToBalance = 0;
  let totalPenalty = 0;

  // Initialize monthly data
  const monthlyData = MONTH_NAMES.map((monthName) => ({
    month: monthName,
    noofcollections: 0,
    amountcollected: 0,
    remitted: 0,
    excess: 0,
    tobalance: 0,
    penalty: 0
  }));

  try {
    // Fetch default_cash_account
    const orgSettingsQuery = `SELECT default_cash_account FROM sky."Organisationsettings" LIMIT 1`;
    const { rows: orgSettings } = await pg.query(orgSettingsQuery);
    const defaultCashAccount = orgSettings[0]?.default_cash_account;

    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
    let queryConditions = [
      `t.transactiondate >= $1`,
      `t.transactiondate < $2`,
      `t."cashref" IS NOT NULL`,
      `t."cashref" <> ''`,
      `t.ttype IN ('CREDIT', 'DEBIT')`,
      `t.status = 'ACTIVE'`,
      `t.accountnumber != $3`
    ];
    let queryParams = [yearStart.toISOString(), yearEnd.toISOString(), defaultCashAccount];

    if (userid) {
      queryConditions.push(`t.userid = $${queryParams.length + 1}`);
      queryParams.push(userid);
    }

    if (branch) {
      queryConditions.push(`u.branch = $${queryParams.length + 1}`);
      queryParams.push(branch);
    }

    if (registrationpoint) {
      queryConditions.push(`u.registrationpoint = $${queryParams.length + 1}`);
      queryParams.push(registrationpoint);
    }

    const yearDataQuery = `
      SELECT t.*
      FROM sky."transaction" t
      JOIN sky."User" u ON t.userid = u.id
      WHERE ${queryConditions.join(' AND ')}
    `;

    const yearDataResult = await pg.query(yearDataQuery, queryParams);
    const yearData = yearDataResult.rows;

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(Date.UTC(year, monthIndex, day));
        const yearStr = currentDate.getUTCFullYear();
        const monthStr = String(currentDate.getUTCMonth() + 1).padStart(2, "0");
        const dayStr = String(currentDate.getUTCDate()).padStart(2, "0");
        const dateString = `${yearStr}${monthStr}${dayStr}`;
        const cashRefPrefix = `CR-${dateString}-${userid}`;

        const dayData = yearData.filter((tx) => tx.cashref.startsWith(cashRefPrefix));

        if (dayData.length === 0) {
          continue;
        }

        const creditTransactions = dayData.filter((tx) => tx.ttype === "CREDIT");
        const noofcollections = creditTransactions.length;
        const amountcollected = creditTransactions.reduce(
          (sum, tx) => sum + (tx.credit || 0),
          0
        );

        const debitSum = dayData
          .filter((tx) => tx.ttype === "DEBIT")
          .reduce((sum, tx) => sum + (tx.debit || 0), 0);

        const transactionRefs = dayData.map((tx) => tx.cashref).filter(Boolean);
        let remitted = 0;
        if (transactionRefs.length > 0) {
          const bankTxQuery = `
            SELECT credit, debit 
            FROM sky."banktransaction"
            WHERE transactionref = ANY($1) AND status = 'ACTIVE'
          `;
          const bankTxResult = await pg.query(bankTxQuery, [transactionRefs]);
          const bankTransactions = bankTxResult.rows;

          const bankTxSum = bankTransactions.reduce(
            (sum, btx) => sum + ((btx.credit || 0) - (btx.debit || 0)),
            0
          );
          remitted = bankTxSum;
        }

        const penaltyRefs = transactionRefs.map((ref) => `${ref}-P`);
        let penaltySum = 0;
        if (penaltyRefs.length > 0) {
          const penaltyQuery = `
            SELECT debit, credit 
            FROM sky."transaction"
            WHERE cashref = ANY($1) AND status = 'ACTIVE' AND accountnumber != $2
          `;
          const penaltyResult = await pg.query(penaltyQuery, [penaltyRefs, defaultCashAccount]);
          const penaltyTransactions = penaltyResult.rows;

          penaltySum = penaltyTransactions.reduce(
            (sum, ptx) => sum + ((ptx.debit || 0) - (ptx.credit || 0)),
            0
          );
        }

        const net = amountcollected - remitted;
        let excess = 0;
        let tobalance = 0;
        if (net > 0) {
          tobalance = net;
        } else {
          excess = Math.abs(net);
        }

        // Update monthly data
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

    const totals = {
      totalNoOfCollections,
      totalAmountCollected,
      totalRemitted,
      totalExcess,
      totalToBalance,
      totalPenalty
    };

    await activityMiddleware(req, user.id, 'User yearly collection fetched successfully', 'USER_YEARLY_COLLECTION');

    return res.status(StatusCodes.OK).json({
      status: true,
      message: "User yearly collection fetched successfully",
      statuscode: StatusCodes.OK,
      data: monthlyData,
      totals,
      errors: []
    });
  } catch (error) {
    console.error('Error fetching user yearly collection:', error);
    await activityMiddleware(req, user.id, 'An unexpected error occurred fetching user yearly collection', 'USER_YEARLY_COLLECTION');

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "An unexpected error occurred",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [error.message]
    });
  }
};

module.exports = { viewCollectionsForTheYear };
