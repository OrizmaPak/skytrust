const { StatusCodes } = require("http-status-codes");
const pg = require("../../../../db/pg");
const { activityMiddleware } = require("../../../../middleware/activity");
const { performTransactionOneWay, performTransaction } = require("../../../../middleware/transactions/performTransaction");

const processWithdrawal = async (req, res) => {
    // Destructure and set default values for request body parameters
    let { allocation = 0, branch, userid, rowsize, location = "OUTSIDE", cashref } = req.body;

    const originalCashref = cashref

    const user = req.user;

    // Validate required fields
    if (!branch || !userid || !rowsize) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Branch, user, and rowsize are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        // Check if the branch is active
        const { rows: branchData } = await pg.query(`
            SELECT * FROM skyeu."Branch" WHERE id = $1 AND status = 'ACTIVE'
        `, [branch]);

        if (branchData.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Invalid branch or branch could be inactive",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        // Validate user ID
        const { rows: userData } = await pg.query(`
            SELECT * FROM skyeu."User" WHERE id = $1
        `, [userid]);

        if (userData.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Invalid user ID",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        // Check if the user is a marketer and not a member
        const { rows: userCheckData } = await pg.query(`
            SELECT * FROM skyeu."User" WHERE id = $1
        `, [userid]);

        if (userCheckData.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "User not found",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        if (!userCheckData[0].registrationpoint) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "This user is not a marketer",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        if (userCheckData[0].role == 'MEMBER') {
            return res.status(StatusCodes.FORBIDDEN).json({
                status: false,
                message: "Members cannot process transactions",
                statuscode: StatusCodes.FORBIDDEN,
                data: null,
                errors: []
            });
        }

        // Retrieve the withdrawal limit for the cashier
        const { rows: cashierLimitData } = await pg.query(`
            SELECT withdrawallimit FROM skyeu."Cashierlimit" WHERE cashier = $1 AND status = 'ACTIVE'
        `, [userid]);

        const withdrawalLimit = (cashierLimitData.length > 0 && cashierLimitData[0].withdrawallimit !== undefined) ? cashierLimitData[0].withdrawallimit : 0;

        // Generate a unique cash reference for the transaction
        const timestamp = new Date().getTime();
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        if(cashref){
            cashref = cashref
        }else{
            cashref = `WD-${year}${month}${day}-${userid}`;
        }

        let failedTransactions = [];

        // Begin database transaction
        // await pg.query('BEGIN');

        // Process each withdrawal request
        for (let i = 1; i <= rowsize; i++) {
            let accountnumber = req.body[`accountnumber${i}`];
            const debit = req.body[`debit${i}`];

            // Validate account number and debit amount
            if (!accountnumber || !debit) {
                // await pg.query('ROLLBACK');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Account number and debit are required for row ${i}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            // Check if the debit amount exceeds the withdrawal limit
            // if (Number(debit) > withdrawalLimit) {
            //     await pg.query('ROLLBACK');
            //     return res.status(StatusCodes.FORBIDDEN).json({
            //         status: false,
            //         message: `Transaction amount for row ${i} exceeds the cashier limit of ${withdrawalLimit}. The customer associated with account number ${accountnumber} has already been informed about this issue. Please proceed to refund the customer.`,
            //         statuscode: StatusCodes.FORBIDDEN,
            //         data: null,
            //         errors: []
            //     });
            // }

            // Retrieve organization settings for the default cash account
            const { rows: orgSettingsData } = await pg.query(`
                SELECT default_cash_account, default_allocation_account, personal_account_prefix FROM skyeu."Organisationsettings" WHERE status = 'ACTIVE'
            `);

            if (orgSettingsData.length === 0) {
                // await pg.query('ROLLBACK');
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Organization settings not found or inactive",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }

            const orgDefaultCashAccount = orgSettingsData[0].default_cash_account;
            const orgDefaultAllocationAccount = orgSettingsData[0].default_allocation_account;
            const orgPersonalAccountPrefix = orgSettingsData[0].personal_account_prefix;

            // Check the available balance for the branch's cash account
            const { rows: accountTransactions } = await pg.query(`
                SELECT SUM(credit) - SUM(debit) as balance
                FROM skyeu."transaction"
                WHERE accountnumber = $1 AND branch = $2 AND status = 'ACTIVE'
            `, [orgDefaultCashAccount, branch]);

            const accountBalance = accountTransactions[0].balance || 0;

            if (Number(debit) > accountBalance) {
                // await pg.query('ROLLBACK');
                return res.status(StatusCodes.FORBIDDEN).json({
                    status: false,
                    message: `Insufficient cash balance for your branch. The available balance is ${accountBalance}.`,
                    statuscode: StatusCodes.FORBIDDEN,
                    data: null,
                    errors: []
                });
            }

            // Check the available balance for the account to withdraw from account
            const { rows: accountfromTransactions } = await pg.query(`
                SELECT SUM(credit) - SUM(debit) as balance
                FROM skyeu."transaction"
                WHERE accountnumber = $1 AND status = 'ACTIVE'
            `, [accountnumber]);

            const accountfromBalance = accountfromTransactions[0].balance || 0;

            if (!originalCashref && allocation == 0 && Number(debit) > accountfromBalance) {
                // await pg.query('ROLLBACK');
                return res.status(StatusCodes.FORBIDDEN).json({
                    status: false,
                    message: `Insufficient balance for ${accountnumber} account. The available balance is ${accountfromBalance}.`,
                    statuscode: StatusCodes.FORBIDDEN,
                    data: null,
                    errors: []
                });
            }

            let accountnumberuserid

            if(!originalCashref &&allocation == 1){
                // Remove the personal_account_prefix from the accountnumber to extract the phonenumber
                const phonenumber = accountnumber.replace(orgPersonalAccountPrefix, '');

                // Use the phonenumber to get the user and retrieve the id
                const { rows: userByPhoneData } = await pg.query(`
                    SELECT id FROM skyeu."User" WHERE phone = $1 AND status = 'ACTIVE'
                `, [phonenumber]);

                if (userByPhoneData.length === 0) {
                    // await pg.query('ROLLBACK');
                    return res.status(StatusCodes.NOT_FOUND).json({
                        status: false,
                        message: "User for not found with the provided Account Number",
                        statuscode: StatusCodes.NOT_FOUND,
                        data: null,
                        errors: []
                    });
                }
                accountnumberuserid = userByPhoneData[0].id;

                // Check the balance of the user's default_allocation_account
                const { rows: allocationAccountTransactions } = await pg.query(`
                    SELECT SUM(credit) - SUM(debit) as balance
                    FROM skyeu."transaction"
                    WHERE accountnumber = $1 AND userid = $2 AND status = 'ACTIVE'  
                `, [orgDefaultAllocationAccount, accountnumberuserid]);

                const allocationAccountBalance = allocationAccountTransactions[0].balance || 0;

                if (Number(debit) > Number(allocationAccountBalance)) {
                    // await pg.query('ROLLBACK');
                    return res.status(StatusCodes.FORBIDDEN).json({
                        status: false,
                        message: `Insufficient balance in the default allocation account of the user. The available balance is ${allocationAccountBalance}.`,
                        statuscode: StatusCodes.FORBIDDEN,
                        data: null,
                        errors: []
                    });
                }
                accountnumber = orgDefaultAllocationAccount
            } 

            // Prepare transaction details for the debit account and cash account
            const transactionDetails = {
                debitAccount: {
                    accountnumber,
                    credit: 0,
                    debit: Number(debit),
                    reference: "",
                    transactiondate: new Date(),
                    transactiondesc: (location === 'INSIDE' ? 'BRANCH ' : '') + ' Cash Withdrawal transaction processed by ' + userCheckData[0].firstname + ' ' + userCheckData[0].lastname + ' ' + userCheckData[0].othernames,
                    cashref: cashref,
                    currency: 'USD',
                    description: (location === 'INSIDE' ? 'BRANCH ' : '') + `Cash Withdrawal of ${debit} from account ${accountnumber}`,
                    branch,
                    registrationpoint: userCheckData[0].registrationpoint,
                    ttype: 'DEBIT',
                    tfrom: allocation ? 'BANK' : 'CASH',
                    tax: false,
                },
                debitcashAccount: {
                    accountnumber,
                    credit: 0,
                    debit: Number(debit),
                    reference: "",
                    transactiondate: new Date(),
                    transactiondesc: (location === 'INSIDE' ? 'BRANCH ' : '') + `Cash Withdrawal transaction processed to ${accountnumber} by ` + userCheckData[0].firstname + ' ' + userCheckData[0].lastname + ' ' + userCheckData[0].othernames,
                    cashref: cashref,
                    currency: 'USD',
                    description: (location === 'INSIDE' ? 'BRANCH ' : '') + `Cash Withdrawal of ${debit} to from cash account to ${accountnumber}`,
                    branch,
                    registrationpoint: userCheckData[0].registrationpoint,
                    ttype: 'DEBIT',
                    tfrom: 'CASH',
                    tax: false,
                }
            };

            // Perform the transaction
            const transactionResult = originalCashref 
                ? await performTransactionOneWay(transactionDetails.debitAccount, allocation == 1 ? accountnumberuserid : userCheckData[0].id)
                : await performTransaction(transactionDetails.debitcashAccount, allocation == 1 ? accountnumberuserid : userCheckData[0].id);

            if(!originalCashref && allocation == 1){
            const creditTransactionDetails = {
                accountnumber: accountnumber,
                credit: Number(debit),
                debit: 0,
                reference: "",
                transactiondate: new Date(),
                transactiondesc: (location === 'INSIDE' ? 'BRANCH ' : '') + ' Cash Withdrawal reversal processed by ' + userCheckData[0].firstname + ' ' + userCheckData[0].lastname + ' ' + userCheckData[0].othernames,
                cashref: cashref,
                currency: 'USD',
                description: (location === 'INSIDE' ? 'BRANCH ' : '') + `Cash Withdrawal reversal of ${debit} to account ${accountnumber}`,
                branch,
                registrationpoint: userCheckData[0].registrationpoint,
                ttype: 'CREDIT',
                tfrom: 'CASH',
                tax: false,
            };

            // Perform the one-way credit transaction
            const creditTransactionResult = await performTransactionOneWay(creditTransactionDetails, allocation == 1 ? accountnumberuserid : userCheckData[0].id);
            }

            // Prepare bank transaction details
            const bankTransactionDetails = {
                accountnumber: orgDefaultCashAccount,
                userid: userCheckData[0].id,
                description: transactionDetails.debitcashAccount.description,
                debit: Number(debit),
                credit: 0,
                ttype: 'WITHDRAWAL',
                tfrom: 'CASH',
                createdby: user.id,
                valuedate: new Date(),
                reference: transactionDetails.debitcashAccount.reference,
                transactiondate: transactionDetails.debitcashAccount.transactiondate,
                transactiondesc: transactionDetails.debitcashAccount.transactiondesc,
                transactionref: cashref,
                status: 'ACTIVE',
                whichaccount: 'CASH',
                rawdata: JSON.stringify(transactionDetails)
            };

            // Insert the bank transaction into the database
            const bankTransactionQuery = {
                text: `INSERT INTO skyeu."banktransaction" 
                       (accountnumber, userid, description, debit, credit, ttype, tfrom, createdby, valuedate, reference, transactiondate, transactiondesc, transactionref, status, whichaccount, rawdata) 
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
                values: [
                    bankTransactionDetails.accountnumber,
                    bankTransactionDetails.userid,
                    bankTransactionDetails.description,
                    bankTransactionDetails.debit,
                    bankTransactionDetails.credit,
                    bankTransactionDetails.ttype,
                    bankTransactionDetails.tfrom,
                    bankTransactionDetails.createdby,
                    bankTransactionDetails.valuedate,
                    bankTransactionDetails.reference,
                    bankTransactionDetails.transactiondate,
                    bankTransactionDetails.transactiondesc,
                    bankTransactionDetails.transactionref,
                    bankTransactionDetails.status,
                    bankTransactionDetails.whichaccount,
                    bankTransactionDetails.rawdata
                ]
            };

            const orgDebitTransaction = await pg.query(bankTransactionQuery);

            // Track failed transactions
            if (!orgDebitTransaction) {
                failedTransactions.push(i);
            }

            if (!transactionResult) {
                failedTransactions.push(i);
            }
        }

        // Rollback if any transaction failed
        if (failedTransactions.length > 0) {
            // await pg.query('ROLLBACK');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Failed to debit accounts for rows: ${failedTransactions.join(', ')}.`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Commit the transaction if all operations were successful
        // await pg.query('COMMIT');
        await activityMiddleware(req, user.id, 'Withdrawals processed successfully', 'TRANSACTION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Withdrawals processed successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        // Handle unexpected errors
        console.error('Unexpected Error:', error);
        // await pg.query('ROLLBACK');
        await activityMiddleware(req, user.id, 'An unexpected error occurred processing withdrawals', 'TRANSACTION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { processWithdrawal };
