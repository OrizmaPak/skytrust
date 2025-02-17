const { saveTransaction } = require("../../../utils/transactionHelper");
const { activityMiddleware } = require("../../activity");

async function glAccountDebit(client, req, res, next, glAccountNumber, debit, description, ttype, transactionStatus, whichaccount) {
    if (debit > 0) {
        try {
            await saveTransaction(client, res, {
                accountnumber: glAccountNumber,
                credit: 0,
                debit,
                description,
                ttype,
                status: "ACTIVE",
                whichaccount
            }, req);
            req.body.transactiondesc += `An amount of ${req.body.currency} ${debit} has been successfully debited from the GL account.|`;
            await client.query('COMMIT'); // Commit the transaction
            await activityMiddleware(req, req.user.id, 'GL Account Debit transaction saved successfully', 'TRANSACTION'); // Log activity
        } catch (error) {
            await client.query('ROLLBACK'); // Rollback the transaction on error
            console.error('Error saving GL Account Debit transaction:', error);
            throw error;
        }
        // return next()
    }
}

module.exports = { glAccountDebit };

