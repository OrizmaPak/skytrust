const { StatusCodes } = require("http-status-codes");
const pg = require("../../../../db/pg");
const { activityMiddleware } = require("../../../../middleware/activity");
const { performTransactionOneWay } = require("../../../../middleware/transactions/performTransaction");

const processCashCollection = async (req, res) => {
    const timestamp = new Date().getTime();
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}${month}${day}`;
    let { branch, userid, rowsize, location="OUTSIDE", cashref } = req.body;
    const reqCashref = cashref
    if (!cashref) {
        cashref = `DP-${dateString}-${userid}`;
    }
    // location can be "OUTSIDE" or "INSIDE".... inside is when it is made from the branch
    const user = req.user;

    if (!branch || !userid || !rowsize) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Branch, user, and rowsize are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    if (!cashref) {
        return res.status(StatusCodes.BAD_REQUEST).json({  
            status: false,
            message: "marketer reference is required", 
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        // Validate branch
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

        // Validate userid
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

        // Check if the user has a registrationpoint and the role is not 'member'
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

        // Check cashier limit
        const { rows: cashierLimitData } = await pg.query(`
            SELECT depositlimit FROM skyeu."Cashierlimit" WHERE cashier = $1 AND status = 'ACTIVE'
        `, [userid]);

        // if (cashierLimitData.length === 0) {
        //     return res.status(StatusCodes.NOT_FOUND).json({
        //         status: false,
        //         message: "Cashier limit not found or inactive",
        //         statuscode: StatusCodes.NOT_FOUND,
        //         data: null,
        //         errors: []
        //     });
        // }

        const depositLimit = (cashierLimitData.length > 0 && cashierLimitData[0].depositlimit !== null) ? cashierLimitData[0].depositlimit : 200000000;

        
        
        // const cashref = cashref;

        // Process multiple transactions
        let failedTransactions = [];

        const { rows: orgSettingsData } = await pg.query(`
            SELECT default_cash_account FROM skyeu."Organisationsettings" WHERE status = 'ACTIVE'
        `);

        if (orgSettingsData.length === 0) {
            await pg.query('ROLLBACK');
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Organization settings not found or inactive",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        const orgDefaultCashAccount = orgSettingsData[0].default_cash_account;

        // await pg.query('BEGIN');

        for (let i = 1; i <= rowsize; i++) {
            const accountnumber = req.body[`accountnumber${i}`];
            const credit = req.body[`credit${i}`];

            if (!accountnumber || !credit) {
                // await pg.query('ROLLBACK');
                return res.status(StatusCodes.BAD_REQUEST).json({ 
                    status: false,
                    message: `Account number and credit are required for row ${i}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            if (Number(credit) > depositLimit) {
                // await pg.query('ROLLBACK');
                return res.status(StatusCodes.FORBIDDEN).json({
                    status: false,
                    message: `Transaction amount for row ${i} exceeds the cashier limit of ${depositLimit}. The customer associated with account number ${accountnumber} has already been informed about this issue. Please proceed to refund the customer.`,
                    statuscode: StatusCodes.FORBIDDEN,
                    data: null,
                    errors: []
                });
            }

            const transaction = {
                accountnumber,
                credit: Number(credit),
                debit: 0,
                reference: "",
                transactiondate: new Date(),
                transactiondesc: (location === 'INSIDE' ? 'BRANCH ' : '') + 'Credit Cash transaction collected by ' + userCheckData[0].firstname + ' ' + userCheckData[0].lastname + ' ' + userCheckData[0].othernames,
                cashref: cashref,
                currency: 'USD',
                description: (location === 'INSIDE' ? 'BRANCH ' : '') + `Credit of ${credit} to account ${accountnumber}`,
                branch,
                registrationpoint: userCheckData[0].registrationpoint,
                ttype: 'CREDIT', 
                tfrom: 'CASH',
                tax: false,
            };
            
            const creditTransaction = !reqCashref ? await performTransactionOneWay(transaction, userCheckData[0].id) : true;
            
            const transactiondefault = {
                accountnumber: orgDefaultCashAccount,
                credit: Number(credit),
                debit: 0,
                reference: "",
                transactiondate: new Date(),
                transactiondesc: (location === 'INSIDE' ? 'BRANCH ' : '') + 'Credit Cash transaction collected by ' + userCheckData[0].firstname + ' ' + userCheckData[0].lastname + ' ' + userCheckData[0].othernames + (!reqCashref ? ' as a collection remittance by the marketer' : ''),
                cashref: cashref,
                currency: 'USD',
                description: (location === 'INSIDE' ? 'BRANCH ' : '') + `Credit of ${credit} to account ${accountnumber}` + (!reqCashref ? ' as a collection remittance by the marketer' : ''),
                branch,
                registrationpoint: userCheckData[0].registrationpoint,
                ttype: 'CREDIT', 
                tfrom: 'CASH',
                tax: false,
            };

            console.log('orgDefaultCashAccount', orgDefaultCashAccount);
            
            const creditTransactiondefault = await performTransactionOneWay(transactiondefault, userCheckData[0].id);

           
            

            function generateRandomComplexReference() {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let reference = '';
                for (let i = 0; i < 16; i++) {
                    reference += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return reference;
            }

            // Perform another deposit to the default cash account and save it directly to the table
            const defaultCashTransactionQuery = `
                INSERT INTO skyeu."banktransaction" 
                (accountnumber, userid, description, debit, credit, ttype, tfrom, createdby, valuedate, reference, transactiondate, transactiondesc, transactionref, status, whichaccount, rawdata)
                VALUES 
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            `;
            const defaultCashTransactionValues = [
                orgDefaultCashAccount,
                userCheckData[0].id,
                (location === 'INSIDE' ? 'BRANCH ' : '') + `Credit of ${credit} to default cash account` + (!reqCashref ? ' as a collection remittance by the marketer' : ''),
                0,
                Number(credit),
                'CREDIT',
                'CASH',
                user.id,
                new Date(),
                generateRandomComplexReference(),
                new Date(),
                (location === 'INSIDE' ? 'BRANCH ' : '') + 'Credit to default cash account by ' + userCheckData[0].firstname + ' ' + userCheckData[0].lastname + ' ' + userCheckData[0].othernames + (!reqCashref ? ' as a collection remittance by the marketer' : ''),
                cashref,
                'ACTIVE',
                'CASH BANK',
                null
            ];

            await pg.query(defaultCashTransactionQuery, defaultCashTransactionValues);

            if (!creditTransaction) {
                failedTransactions.push(i);
            }

            if (!creditTransactiondefault) {
                failedTransactions.push(i);
            }
        }

        if (failedTransactions.length > 0) {
            // await pg.query('ROLLBACK');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Failed to credit accounts for rows: ${failedTransactions.join(', ')}.`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // await pg.query('COMMIT');
        await activityMiddleware(req, user.id, 'Transactions processed successfully', 'TRANSACTION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Transactions processed successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        // await pg.query('ROLLBACK');
        await activityMiddleware(req, user.id, 'An unexpected error occurred processing transactions', 'TRANSACTION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { processCashCollection };
