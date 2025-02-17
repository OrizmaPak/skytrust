const { saveTransaction } = require("../../../utils/transactionHelper");
const { activityMiddleware } = require("../../activity");

async function rotaryCredit(client, req, res, next, rotaryAccountNumber, credit, description, ttype, transactionStatus, whichaccount) {
    if (credit > 0) {
        console.log('we entered where its to be saved')
        try {
            await saveTransaction(client, res, {
                accountnumber: rotaryAccountNumber,
                credit,
                debit: 0, // Assuming debit is 0 for credit transactions
                description,
                ttype,
                status: "ACTIVE", 
                whichaccount
            }, req);
            req.body.transactiondesc += `An amount of ${req.body.currency} ${credit} has been successfully credited to the rotary account.|`;
            await client.query('COMMIT'); // Commit the transaction
            await activityMiddleware(req, req.user.id, 'Rotary Account Credit transaction saved successfully', 'TRANSACTION'); // Log activity
        } catch (error) {
            await client.query('ROLLBACK'); // Rollback the transaction on error
            console.error('Error saving Rotary Account Credit transaction:', error);
            throw error;
        }
        return next()
    }
}

module.exports = { rotaryCredit };