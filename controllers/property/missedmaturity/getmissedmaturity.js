const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

/**
 * GET /
 * Query Param: ?accountnumber=xxxx
 *
 * Logic:
 *  1) Fetch propertyaccount, product, items, installments
 *  2) Check for installments where:
 *      - The due date has passed
 *      - The description matches "Release item with itemid XXX to the customer."
 *      - The installment is NOT fully paid (resolve payment status manually from transactions)
 *  3) Add a key "remaining" to items where the maturity has missed/passed, showing the amount left to be paid.
 */
async function getMissedMaturity(req, res) {
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

    // 2) Fetch propertyaccount and product details
    const propertyAccountQuery = `
      SELECT 
        pa.*, 
        pp.* 
      FROM skyeu."propertyaccount" pa
      JOIN skyeu."propertyproduct" pp 
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
    const releasePattern = /^Release item with itemid (\d+) to the customer\.$/i;

    // 4) Process each account individually
    for (const accountRow of accountRows) {
      const currentAccountNumber = accountRow.accountnumber;

      // --- 4a) Get all installments for this account
      const installmentsQuery = {
        text: `
          SELECT * 
          FROM skyeu."propertyinstallments"
          WHERE accountnumber = $1
          ORDER BY duedate ASC
        `,
        values: [currentAccountNumber]
      };
      const { rows: rawInstallments } = await pg.query(installmentsQuery);

      // Fetch all transactions for this account
      const transactionsQuery = {
        text: `
          SELECT 
            id, 
            credit,
            debit,
            transactionref, 
            dateadded
          FROM skyeu."transaction"
          WHERE accountnumber = $1
          ORDER BY dateadded ASC
        `,
        values: [currentAccountNumber]
      };
      const { rows: allTransactions } = await pg.query(transactionsQuery);

      // Separate credits and debits, and manually resolve payment status
      let creditTxs = allTransactions
        .filter((tx) => tx.credit !== 0)
        .map((tx) => ({
          ...tx,
          remainingAmount: Number(tx.credit) // remaining amount to apply to installments
        }));

      const debitTxs = allTransactions
        .filter((tx) => tx.debit !== 0)
        .map((tx) => ({ ...tx, amount: Number(tx.debit) }));

      // Apply debits to earliest credits
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

      // Resolve payment status for each installment manually
      const installmentRows = rawInstallments.map((inst) => {
        let amountPaid = 0;

        for (const cred of creditTxs) {
          if (cred.remainingAmount > 0) {
            const allocation = Math.min(cred.remainingAmount, inst.amount - amountPaid);
            amountPaid += allocation;
            cred.remainingAmount -= allocation;

            if (amountPaid >= inst.amount) break;
          }
        }

        const amountOwed = inst.amount - amountPaid;
        let paymentStatus = "NOT PAID";
        if (amountOwed === 0) {
          paymentStatus = "COMPLETED";
        } else if (amountPaid > 0) {
          paymentStatus = "PARTLY PAID";
        }

        return {
          ...inst,
          amountpaid: amountPaid,
          amountowed: amountOwed,
          paymentstatus: paymentStatus
        };
      });

      // Filter missed installments based on conditions
      const missedInstallments = [];

      for (const inst of installmentRows) {
        if (inst.duedate < new Date() && inst.paymentstatus !== "COMPLETED" && inst.description) {
          const match = releasePattern.exec(inst.description);
          if (match) {
            const itemid = Number(match[1]);

            // Fetch property item to ensure it exists and is active but not delivered
            const itemQuery = {
              text: `
                SELECT * 
                FROM skyeu."propertyitems"
                WHERE accountnumber = $1
                  AND itemid = $2
                  AND status = 'ACTIVE'
                  AND delivered = false
              `,
              values: [currentAccountNumber, itemid]
            };

            const { rows: itemRows } = await pg.query(itemQuery);

            if (itemRows.length > 0) {
              // Fetch item name from inventory table
              const inventoryQuery = {
                text: `
                  SELECT itemname 
                  FROM skyeu."inventory"
                  WHERE itemid = $1
                `,
                values: [itemid]
              };

              const { rows: inventoryRows } = await pg.query(inventoryQuery);
              const itemName = inventoryRows.length > 0 ? inventoryRows[0].itemname : "Unknown Item";

              // Add "remaining" key to the item to indicate how much is left to pay
              const remainingAmount = inst.amountowed;
              const itemWithRemaining = {
                ...itemRows[0],
                itemname: itemName,
                remaining: remainingAmount
              };

              missedInstallments.push({
                installment: inst,
                item: itemWithRemaining
              });
            }
          }
        }
      }

      // If no missed installments, skip this account
      if (missedInstallments.length === 0) {
        continue;
      }

      // 5) Final object for the account
      const finalAccountObj = {
        ...accountRow,
        missedInstallments
      };

      results.push(finalAccountObj);
    }

    // 6) Log activity
    await activityMiddleware(
      req,
      user.id,
      "Fetched accounts with missed maturity installments successfully",
      "MISSED_MATURITY"
    );

    // 7) Return the combined result
    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Successfully fetched accounts with missed maturity installments",
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
      "An unexpected error occurred fetching missed maturity accounts",
      "MISSED_MATURITY"
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
  getMissedMaturity
};
