const { saveTransaction } = require("../../../utils/transactionHelper");
const { activityMiddleware } = require("../../activity");

async function glAccountCredit(client, req, res, next, glAccountNumber, credit, description, ttype, transactionStatus, whichaccount) {
    if (credit > 0) {
        console.log('we entered where its to be saved')
        try {
            await saveTransaction(client, res, {
                accountnumber: glAccountNumber,
                credit,
                debit: 0, // Assuming debit is 0 for credit transactions
                description,
                ttype,
                status: "ACTIVE", 
                whichaccount
            }, req);
            req.body.transactiondesc += `An amount of ${req.body.currency} ${credit} has been successfully credited to the GL account.|`;
            await client.query('COMMIT'); // Commit the transaction
            await activityMiddleware(req, req.user.id, 'GL Account Credit transaction saved successfully', 'TRANSACTION'); // Log activity
        } catch (error) {
            await client.query('ROLLBACK'); // Rollback the transaction on error
            console.error('Error saving GL Account Credit transaction:', error);
            throw error;
        }
        return next()
    }
}

module.exports = { glAccountCredit };