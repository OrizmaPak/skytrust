const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

/**
 * GET /propertyaccount
 * Query Param: ?accountnumber=xxxx
 * 
 * Logic:
 *  1) Fetch propertyaccount, product, items, installments
 *  2) Fetch all transactions, net out credits vs. debits
 *  3) Allocate leftover credits to installments => paymentstatus: NOT PAID, PARTLY PAID, or COMPLETED
 *  4) **Condition**: We only return an account if:
 *      - There's at least one COMPLETED installment whose description matches
 *        "Release item with itemid XXX to the customer."
 *      - That item (XXX) exists in propertyitems with status='ACTIVE' AND delivered='NO'
 */
async function getMaturedPropertyAccount(req, res) {
  const { accountnumber } = req.query;
  const user = req.user || {};

  try {
    // 1) Optional filter by accountnumber
    let accountFilter = "";
    const values = [];
    if (accountnumber) {
      accountFilter = `WHERE pa.accountnumber = $1`;
      values.push(accountnumber);
    }

    // 2) propertyaccount + product details in one go
    const propertyAccountQuery = `
      SELECT 
        pa.*,
        pp.* 
      FROM sky."propertyaccount" pa
      JOIN sky."propertyproduct" pp 
        ON pa.productid = pp.id
      ${accountFilter}
      ORDER BY pa.dateadded DESC
    `;
    const { rows: accountRows } = await pg.query(propertyAccountQuery, values);

    // 3) If a specific account was requested but not found
    if (accountnumber && accountRows.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: `No property account found with accountnumber: ${accountnumber}`,
        statuscode: StatusCodes.BAD_REQUEST,
        data: null,
        errors: []
      });
    }

    const results = [];

    // We'll use a regex to match: "Release item with itemid XXX to the customer."
    // The itemid is in capture group 1
    const releasePattern = /^Release item with itemid (\d+) to the customer\.$/i;

    // 4) Process each account individually
    for (const accountRow of accountRows) {
      const currentAccountNumber = accountRow.accountnumber;

      // Fetch user details to get fullname and branch
      const userQuery = {
        text: `SELECT firstname, lastname, othernames, branch FROM sky."User" WHERE id = $1`,
        values: [accountRow.userid]
      };
      const { rows: userRows } = await pg.query(userQuery);
      const userFullname = userRows.length > 0 ? `${userRows[0].firstname} ${userRows[0].lastname} ${userRows[0].othernames}`.trim() : "Unknown User";

      // Fetch branch details to get branchname
      const branchQuery = {
        text: `SELECT branch FROM sky."Branch" WHERE id = $1`,
        values: [userRows[0].branch]
      };
      const { rows: branchRows } = await pg.query(branchQuery);
      const branchName = branchRows.length > 0 ? branchRows[0].branch : "Unknown Branch";

      // --- 4a) Get property items
      const itemsQuery = {
        text: `SELECT * FROM sky."propertyitems" WHERE accountnumber = $1`,
        values: [currentAccountNumber]
      };
      const { rows: itemRows } = await pg.query(itemsQuery);

      // Fetch item names from Inventory table
      for (const item of itemRows) {
        const inventoryQuery = {
          text: `SELECT itemname FROM sky."Inventory" WHERE itemid = $1`,
          values: [item.itemid]
        };
        const { rows: inventoryRows } = await pg.query(inventoryQuery);
        if (inventoryRows.length > 0) {
          item.itemname = inventoryRows[0].itemname;
        } else {
          item.itemname = null; // or some default value if itemname is not found
        }
        // Initialize the 'matured' key to false
        item.matured = false;
      }

      // --- 4b) Get installments, sorted by duedate
      const installmentsQuery = {
        text: `
          SELECT * 
          FROM sky."propertyinstallments"
          WHERE accountnumber = $1
          ORDER BY duedate ASC
        `,
        values: [currentAccountNumber]    
      };
      const { rows: rawInstallments } = await pg.query(installmentsQuery);

      // Convert them into a mutable array (each row we will augment with new fields)
      const installmentRows = rawInstallments.map((inst) => ({
        ...inst,
        amountpaid: 0,
        amountowed: Number(inst.amount) || 0,
        paymentstatus: "NOT PAID",
        transactionrefs: []
      }));
 
      // --- 4c) Fetch all transactions for this account
      const transactionsQuery = {
        text: `
          SELECT 
            id, 
            credit,
            debit,
            transactionref, 
            dateadded
          FROM sky."transaction"
          WHERE accountnumber = $1
          ORDER BY dateadded ASC
        `,
        values: [currentAccountNumber]
      };
      const { rows: allTransactions } = await pg.query(transactionsQuery);

      // 4d) Separate credits and debits, then apply debits to earliest credits
      let creditTxs = allTransactions
        .filter((tx) => tx.credit !== 0)
        .map((tx) => ({
          ...tx,
          remainingAmount: Number(tx.credit) // how much is still available to pay installments after debits
        }));

      const debitTxs = allTransactions
        .filter((tx) => tx.debit !== 0)
        .map((tx) => ({ ...tx, amount: Number(tx.debit) }));

      // 5) Apply debits to earliest credits
      for (const debit of debitTxs) {
        let debitRemaining = debit.amount;
        for (const cred of creditTxs) {
          if (debitRemaining <= 0) break;
          if (cred.remainingAmount > 0) {
            const toReduce = Math.min(cred.remainingAmount, debitRemaining);
            cred.remainingAmount -= toReduce;
            debitRemaining -= toReduce;
          }
        }
      }

      // 6) Allocate leftover credit to installments, earliest installments first
      let creditPointer = 0;
      while (creditPointer < creditTxs.length && installmentRows.some((inst) => inst.amountowed > 0)) {
        if (creditTxs[creditPointer].remainingAmount <= 0) {
          creditPointer++;
          continue;
        }
        const currentCreditTx = creditTxs[creditPointer];

        // Find the next unpaid installment
        const nextUnpaidInstallment = installmentRows.find((inst) => inst.amountowed > 0);
        if (!nextUnpaidInstallment) break;

        const allocation = Math.min(
          currentCreditTx.remainingAmount,
          nextUnpaidInstallment.amountowed
        );

        nextUnpaidInstallment.amountpaid += allocation;
        nextUnpaidInstallment.amountowed -= allocation;

        if (nextUnpaidInstallment.amountowed === 0) {
          nextUnpaidInstallment.paymentstatus = "COMPLETED";
        } else if (nextUnpaidInstallment.amountowed < (nextUnpaidInstallment.amount || 0)) {
          nextUnpaidInstallment.paymentstatus = "PARTLY PAID";
        }

        nextUnpaidInstallment.transactionrefs.push({
          transactionref: currentCreditTx.transactionref,
          allocated: allocation
        });

        currentCreditTx.remainingAmount -= allocation;
      }

      // 7) Summaries
      const totalRemitted = installmentRows.reduce((sum, inst) => sum + inst.amountpaid, 0);
      const totalOwed = installmentRows.reduce((sum, inst) => sum + inst.amountowed, 0);
      // leftover credits
      const leftoverCredit = creditTxs.reduce((sum, cred) => sum + cred.remainingAmount, 0);
      const accountBalance = leftoverCredit > 0 ? leftoverCredit : 0;

      // 8) Condition:
      //    Must have at least one COMPLETED installment with a description like
      //    "Release item with itemid XXX to the customer."
      //    Then we parse the itemid and check the propertyitems for status='ACTIVE', delivered='NO'.
      let meetsCondition = false;

      for (const inst of installmentRows) {
        if (inst.paymentstatus === "COMPLETED" && inst.description) {
          const match = releasePattern.exec(inst.description);
          if (match) {
            const itemid = Number(match[1]);

            // Check if there's a propertyitems row with that itemid, status=ACTIVE, delivered='NO'
            const itemMatch = itemRows.find(
              (item) =>
                Number(item.itemid) === itemid &&
                item.status === "ACTIVE" &&
                item.delivered === "NO"
            );

            if (itemMatch) {
              // We found at least one completed installment referencing an undelivered, active item
              meetsCondition = true;
              itemMatch.matured = true; // Set the 'matured' key to true for this item
              break; // no need to check further installments
            }
          }
        }
      }

      // If the condition is not met, skip adding this account to the results
      if (!meetsCondition) {
        continue;
      }

      // 9) Final object
      const finalAccountObj = {
        ...accountRow,
        accountbalance: accountBalance,
        totalRemitted,
        totalOwed,
        fullname: userFullname,
        branchname: branchName
      };

      results.push({
        account: finalAccountObj,
        product: accountRow,     // includes product fields from SELECT
        items: itemRows,
        installments: installmentRows
      });
    }

    // 10) Log activity
    await activityMiddleware(
      req,
      user.id,
      "Fetched matured property account(s) with item release criteria successfully",
      "PROPERTY_ACCOUNT"
    );

    // 11) Return the combined result
    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Successfully fetched matured property account(s) meeting release criteria",
      statuscode: StatusCodes.OK,
      data: {
        accounts: results
      },
      errors: []
    });
  } catch (error) {
    console.error("Unexpected Error:", error);
    await activityMiddleware(
      req,
      user.id || null,
      "An unexpected error occurred fetching property account(s)",
      "PROPERTY_ACCOUNT"
    );

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "An unexpected error occurred",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [error.message]
    });
  }
}

module.exports = {
  getMaturedPropertyAccount
};
