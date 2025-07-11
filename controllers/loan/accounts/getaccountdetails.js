const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

const getLoanAccountDetails = async (req, res) => {
    const { accountnumber } = req.body;

    if (!accountnumber) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Account number is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Account number is required"]
        });
    }

    try {
        // Fetch loan account details
        const loanAccountQuery = {
            text: `SELECT * FROM skyeu."loanaccounts" WHERE accountnumber = $1`,
            values: [accountnumber]
        };
        const loanAccountResult = await pg.query(loanAccountQuery);

        if (loanAccountResult.rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Loan account not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Loan account not found"]
            });
        }

        const loanAccount = loanAccountResult.rows[0];

        // Fetch loan payment schedule
        const loanPaymentScheduleQuery = {
            text: `SELECT * FROM skyeu."loanpaymentschedule" WHERE accountnumber = $1`,
            values: [accountnumber]
        };
        const loanPaymentScheduleResult = await pg.query(loanPaymentScheduleQuery);

        const installments = loanPaymentScheduleResult.rows;

        // Fetch all transactions for the accountnumber
        const transactionsQuery = {
            text: `SELECT * FROM skyeu."transaction" WHERE accountnumber = $1 AND status = 'ACTIVE'`,
            values: [accountnumber]
        };
        const transactionsResult = await pg.query(transactionsQuery);

        const transactions = transactionsResult.rows;

        console.log('transactions', transactions)
        
        let totalBalancePaid = 0;
        // Check if disbursementref has a value
        if (!loanAccount.disbursementref) {
            // If no disbursementref, set payment status to NOT OWED
            transactions.forEach(transaction => {
                totalBalancePaid += transaction.credit - transaction.debit;
            });
            installments.forEach(installment => {
                installment.paymentstatus = 'NOT OWED';
                installment.amountpaid = 0;
                installment.amountunpaid = installment.scheduleamount + installment.interestamount;
            });
        } else {
            // Calculate total balance paid
            transactions.forEach(transaction => {
                totalBalancePaid += transaction.credit - transaction.debit;
            });

            // Match the money with the installments
            installments.forEach(installment => {
                const amountToBePaid = installment.scheduleamount + installment.interestamount;
                if (totalBalancePaid >= amountToBePaid) {
                    installment.paymentstatus = 'FULLY PAID';
                    installment.amountpaid = amountToBePaid;
                    installment.amountunpaid = 0;
                    totalBalancePaid -= amountToBePaid;
                } else if (totalBalancePaid > 0) {
                    installment.paymentstatus = 'PARTLY PAID';
                    installment.amountpaid = totalBalancePaid;
                    installment.amountunpaid = amountToBePaid - totalBalancePaid;
                    totalBalancePaid = 0;
                } else {
                    installment.paymentstatus = 'UNPAID';
                    installment.amountpaid = 0;
                    installment.amountunpaid = amountToBePaid;
                }
            });
        }

        // Fetch penalties
        let penalties = [];
        if (loanAccount.defaultpenaltyid) {
            const penaltyQuery = {
                text: `SELECT * FROM skyeu."loanfee" WHERE id = $1`,
                values: [loanAccount.defaultpenaltyid]
            };
            const penaltyResult = await pg.query(penaltyQuery);
            penalties = penaltyResult.rows;
        }

        // Construct response
        const response = {
            ...loanAccount,
            installments,
            refund: 0,
            penalties
        };

        // Add refund field if there are transactions
        if (transactions.length > 0) {
            response.refund = totalBalancePaid;
        }

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Loan account details fetched successfully",
            statuscode: StatusCodes.OK,
            data: response,
            errors: null
        });
    } catch (error) {
        console.error("Error fetching loan account details:", error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal server error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = {
    getLoanAccountDetails
};
