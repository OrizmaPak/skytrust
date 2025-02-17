const { saveTransaction } = require("../../../utils/transactionHelper");
const { activityMiddleware } = require("../../activity");


async function personalDebit(client, req, res, next, accountnumber, debit, description, ttype, transactionStatus, whichaccount) {
    if (debit > 0) {
        // Query to calculate the current balance by subtracting the sum of debits from the sum of credits for the given account number
        const balanceQuery = `SELECT SUM(credit) - SUM(debit) AS balance FROM sky."transaction" WHERE accountnumber = $1 AND status = 'ACTIVE'`;
        const balanceResult = await client.query(balanceQuery, [accountnumber]);
        const currentBalance = balanceResult.rows[0]?.balance || 0; // Get the current balance or default to 0 if no result

        if (currentBalance >= debit) {
            await saveTransaction(client, res, {
                accountnumber: req.body.personalaccountnumber,
                credit: 0,
                debit,
                description,
                ttype,
                status: 'ACTIVE',
                whichaccount
            }, req);
            req.body.transactiondesc += `An amount of ${req.body.currency} ${debit} has been successfully debited from the personal account.|`;
        } else {
            await saveTransaction(client, res, {
                accountnumber: req.body.personalaccountnumber,
                credit: 0,
                debit,
                description,
                ttype,
                status: 'ACTIVE',
                whichaccount
            }, req);
            req.body.transactiondesc += `Transaction is pending due to insufficient balance. Current balance is ${req.body.currency} ${currentBalance}. Attempted to debit ${req.body.currency} ${debit} from the personal account.|`;
        }
        await client.query('COMMIT'); // Commit the transaction
        await activityMiddleware(req, req.user.id, 'Transaction saved successfully', 'TRANSACTION'); // Log activity
    }
}

module.exports = {
    personalDebit
};
