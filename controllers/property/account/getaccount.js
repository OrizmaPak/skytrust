const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

/**
 * GET /propertyaccount
 * Query Param: ?accountnumber=xxxx
 * If accountnumber is provided, fetch that specific account + details.
 * Otherwise, fetch all accounts.
 *
 * This version:
 *  1) Fetches credits + debits for each account.
 *  2) Applies debits to the earliest credits, leaving net positive credits.
 *  3) Allocates the leftover credits to installments in chronological order,
 *     storing references to the transactions that pay each installment.
 *  4) Computes leftover "accountbalance" if everything is fully paid.
 *  5) Summarizes totalRemitted, totalOwed, etc.
 */
async function getPropertyAccount(req, res) { 
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

    // 4) Process each account individually
    for (const accountRow of accountRows) {
      const currentAccountNumber = accountRow.accountnumber;

      // Fetch user details to get fullname
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

      // Fetch member names
      let memberNames = "No Members";
      if (accountRow.member) {
        const memberIds = accountRow.member.includes('||') ? accountRow.member.split('||') : [accountRow.member];
        const memberNamesArray = [];
        for (const memberId of memberIds) {
          const memberQuery = {
            text: `SELECT member FROM sky."DefineMember" WHERE id = $1`,
            values: [memberId]
          };
          const { rows: memberRows } = await pg.query(memberQuery);
          if (memberRows.length > 0) {
            memberNamesArray.push(memberRows[0].member);
          }
        }
        memberNames = memberNamesArray.join(', ');
      }

      // --- 4a) Get property items
      const itemsQuery = {
        text: `SELECT * FROM sky."propertyitems" WHERE accountnumber = $1`,
        values: [currentAccountNumber]
      };
      const { rows: itemRows } = await pg.query(itemsQuery);

      // Fetch item names from Inventory and add to itemRows
      for (const item of itemRows) {
        const inventoryQuery = {
          text: `SELECT itemname FROM sky."Inventory" WHERE itemid = $1`,
          values: [item.itemid]
        };
        const { rows: inventoryRows } = await pg.query(inventoryQuery);
        item.itemname = inventoryRows.length > 0 ? inventoryRows[0].itemname : "Unknown Item";
      }

      // --- 4b) Get installments, sorted by duedate
      const installmentsQuery = {
        text: `SELECT * 
               FROM sky."propertyinstallments"
               WHERE accountnumber = $1
               ORDER BY duedate ASC`,
        values: [currentAccountNumber]
      };
      const { rows: rawInstallments } = await pg.query(installmentsQuery);

      // Convert them into a mutable array (each row we will augment with new fields)
      const installmentRows = rawInstallments.map((inst) => ({
        ...inst,
        amountpaid: 0,
        amountowed: Number(inst.amount) || 0,
        paymentstatus: "NOT PAID",
        transactionrefs: [] // We'll store references of transactions that pay this installment
      }));

      // --- 4c) Fetch all transactions for this account
      // We'll separate them into credits & debits
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

      // 4d) Separate credits and debits.
      //     We'll first apply all debits to the earliest credits to get a net distribution.
      let creditTxs = allTransactions
        .filter((tx) => tx.credit != 0)
        .map((tx) => ({
          ...tx,
          remainingAmount: Number(tx.credit) // how much is still available to pay installments after debits
        }));

      const debitTxs = allTransactions
        .filter((tx) => tx.debit != 0)
        .map((tx) => ({ ...tx, amount: Number(tx.debit) }));

      // 5) Apply debits to earliest credits
      //    We take each debit in chronological order (already sorted) and reduce from the earliest credit(s).
      for (const debit of debitTxs) {
        let debitRemaining = debit.debit;
        // Move through creditTxs until we exhaust this debit or run out of credits
        for (const cred of creditTxs) {
          if (debitRemaining <= 0) break; // done with this debit

          if (cred.remainingAmount > 0) {
            const toReduce = Math.min(cred.remainingAmount, debitRemaining);
            cred.remainingAmount -= toReduce;
            debitRemaining -= toReduce;
          }
        }
      }
 
      // Now creditTxs array has 'remainingAmount' that reflects net leftover after all debits

      // 6) Allocate leftover credit to installments, earliest installments first
      //    We'll go installment by installment, pulling from creditTxs in ascending date order.
      let creditPointer = 0; // points to the current creditTx we are allocating
      while (creditPointer < creditTxs.length && installmentRows.some((inst) => inst.amountowed > 0)) {
        // If the current creditTx is fully used, move pointer
        if (creditTxs[creditPointer].remainingAmount <= 0) {
          creditPointer++;
          continue;
        }

        const currentCreditTx = creditTxs[creditPointer];

        // Find the next installment that is not fully paid
        const nextUnpaidInstallment = installmentRows.find((inst) => inst.amountowed > 0);
        if (!nextUnpaidInstallment) {
          // If no unpaid installments remain, break out
          break;
        }

        // How much can we allocate to this installment?
        const allocation = Math.min(
          currentCreditTx.remainingAmount,
          nextUnpaidInstallment.amountowed
        );

        // Update installment
        nextUnpaidInstallment.amountpaid += allocation;
        nextUnpaidInstallment.amountowed -= allocation;
        // We'll consider it PARTLY PAID or COMPLETED
        if (nextUnpaidInstallment.amountowed === 0) {
          nextUnpaidInstallment.paymentstatus = "COMPLETED";
        } else if (nextUnpaidInstallment.amountowed < (nextUnpaidInstallment.amount || 0)) {
          nextUnpaidInstallment.paymentstatus = "PARTLY PAID";
        }
        // Add reference info
        nextUnpaidInstallment.transactionrefs.push({
          transactionref: currentCreditTx.transactionref,
          allocated: allocation
        });

        // Update creditTx leftover
        currentCreditTx.remainingAmount -= allocation;
      }

      // 7) Summaries: totalRemitted, totalOwed, leftover -> accountBalance
      const totalRemitted = installmentRows.reduce((sum, inst) => sum + inst.amountpaid, 0);
      const totalOwed = installmentRows.reduce((sum, inst) => sum + inst.amountowed, 0);
      // If there is leftover credit after paying all installments:
      //   sum(creditTxs.remainingAmount)
      const leftoverCredit = creditTxs.reduce((sum, cred) => sum + cred.remainingAmount, 0);
      let accountBalance = leftoverCredit > 0 ? leftoverCredit : 0;

      // 8) Final object
      const finalAccountObj = {
        ...accountRow,
        fullname: userFullname, // Add fullname to the account object
        branchname: branchName, // Add branchname to the account object
        membernames: memberNames, // Add member names to the account object
        accountbalance: accountBalance,
        totalRemitted,
        totalOwed
      };

      results.push({
        account: finalAccountObj,    // propertyaccount + new fields
        product: accountRow,         // product details (since we did SELECT pa.*, pp.*)
        items: itemRows,             // propertyitems with itemname added
        installments: installmentRows
      });
    }

    // 9) Log activity
    await activityMiddleware(req, user.id, "Fetched property account(s) successfully", "PROPERTY_ACCOUNT");

    // 10) Return the combined result
    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Successfully fetched property account(s)",
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
  getPropertyAccount
};
