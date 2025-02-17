const { saveTransaction, handleDebitRedirectToPersonnalAccount, makePaymentAndCloseAccount } = require("../../../utils/transactionHelper");

const loanDebit = async (client, req, res, next, loanAccountNumber, debit, description, ttype, transactionStatus) => {
    try {
        // Begin transaction
        await client.query('BEGIN');

        const loanAccount = req.body.loanaccount;

        // Check if the loan account is closed or if debiting the loan account is not allowed
            // Redirect the debit to personal account using helper function
            await handleDebitRedirectToPersonnalAccount(client, req, res, next, loanAccountNumber, debit, 'DEBIT OF LOAN ACCOUNT NOT ALLOWED', ttype, transactionStatus, 'PERSONAL');
            await client.query('COMMIT');

        await client.query('COMMIT');
        return next();
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error debiting loan account:", error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
            statuscode: 500,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = {
    loanDebit
};
