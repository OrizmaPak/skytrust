    // Start of Selection
    const { StatusCodes } = require("http-status-codes");
    const pg = require("../../../db/pg");
    const { activityMiddleware } = require("../../../middleware/activity");
    
    const viewCollectionsForTheDay = async (req, res) => {
        const user = req.user;
        const { date, branch, registrationpoint, userid } = req.query;
    
        if (!date) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Date is required",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Missing date"]
            });
        }
    
        // Validate date format YYYY-MM-DD
        const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        if (!dateRegex.test(date)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Invalid date format. Expected YYYY-MM-DD",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Invalid date format"]
            });
        }
    
        const [year, month, day] = date.split('-').map(Number);
        const dateString = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    
        try {
            // Get organisation settings to fetch default cash account
            const { rows: orgSettings } = await pg.query(`SELECT default_cash_account FROM sky."Organisationsettings"`);
            const defaultCashAccount = orgSettings[0].default_cash_account;
    
            // Fetch transactions for the specified day, excluding default cash account
            let transactionsQuery = `
                SELECT 
                    t.*, 
                    u.firstname, 
                    u.lastname, 
                    u.othernames,
                    u.registrationpoint,
                    rp.registrationpoint AS registrationpointname,
                    b.branch AS branchname
                FROM 
                    sky."transaction" t
                JOIN 
                    sky."User" u ON t.userid = u.id
                JOIN 
                    sky."Branch" b ON u.branch = b.id
                LEFT JOIN 
                    sky."Registrationpoint" rp ON u.registrationpoint = rp.id
                WHERE 
                    t.transactiondate >= $1 
                    AND t.transactiondate <= $2
                    AND t.status = 'ACTIVE'
                    AND t.ttype IN ('CREDIT', 'DEBIT')
                    AND t.cashref LIKE $3
                    AND t.accountnumber != $4
            `;
    
            const cashRefPattern = userid ? `CR-${dateString}-${userid}` : `CR-${dateString}-%`;
            const queryParams = [startOfDay.toISOString(), endOfDay.toISOString(), cashRefPattern, defaultCashAccount];
    
            // Add branch filter if provided
            if (branch) {
                const branchId = parseInt(branch, 10);
                if (isNaN(branchId)) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: "Invalid branch ID",
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: ["Invalid branch ID"]
                    });
                }
                transactionsQuery += ` AND u.branch = $${queryParams.length + 1}`;
                queryParams.push(branchId);
            }
    
            // Add registration point filter if provided
            if (registrationpoint) {
                transactionsQuery += ` AND u.registrationpoint = $${queryParams.length + 1}`;
                queryParams.push(registrationpoint);
            }
    
            // Add user ID filter if provided
            if (userid) {
                transactionsQuery += ` AND u.id = $${queryParams.length + 1}`;
                queryParams.push(userid);
            }
    
            const { rows: transactions } = await pg.query(transactionsQuery, queryParams);
    
            if (transactions.length === 0) {
                await activityMiddleware(req, user.id, 'No collections found for the specified day', 'VIEW_COLLECTIONS_FOR_THE_DAY');
    
                return res.status(StatusCodes.OK).json({
                    status: true,
                    message: "No collections found for the specified day",
                    statuscode: StatusCodes.OK,
                    data: [],
                    errors: []
                });
            }
    
            // Organize transactions by user
            const userCollections = {};
    
            // Collect all transactionRefs per user for remittance
            const userTransactionRefs = {};
    
            for (const tx of transactions) {
                const userId = tx.userid;
                if (!userCollections[userId]) {
                    userCollections[userId] = {
                        userid: userId,
                        fullname: `${tx.firstname} ${tx.lastname} ${tx.othernames || ''}`.trim(),
                        branchname: tx.branchname,
                        registrationpoint: tx.registrationpoint,
                        registrationpointname: tx.registrationpointname,
                        collected: 0,
                        remitted: 0,
                        penalty: 0, 
                        excess: 0,
                        balance: 0,
                        depositcode: tx.cashref,
                        transactions: new Set() // Use a Set to avoid duplicate transactions
                    };
                    userTransactionRefs[userId] = [];
                }
    
                const user = userCollections[userId];
    
                user.collected += parseFloat(tx.credit || 0) - parseFloat(tx.debit || 0);
    
                // Collect transactionRefs for remittance calculation
                userTransactionRefs[userId].push(tx.cashref);
                
                // Assuming penalty is indicated in description
                const penaltyRefs = `${tx.cashref}-P`;
                let penaltySum = 0;
    
                if (penaltyRefs) {
                    const penaltyQuery = `
                        SELECT debit, credit FROM sky."transaction"
                        WHERE cashref = $1 AND status = 'ACTIVE' AND accountnumber != $2
                    `;
                    const penaltyResult = await pg.query(penaltyQuery, [penaltyRefs, defaultCashAccount]);
                    const penaltyTransactions = penaltyResult.rows;
    
                    penaltySum = penaltyTransactions.reduce((sum, ptx) => sum + (parseFloat(ptx.debit || 0) - parseFloat(ptx.credit || 0)), 0);
                }
    
                user.penalty += penaltySum;
    
                // Add transaction details
                const transactionQuery = `
                    SELECT accountnumber, whichaccount, tfrom, credit
                    FROM sky."transaction"
                    WHERE cashref = $1 AND ttype IN ('CREDIT', 'DEBIT') AND status = 'ACTIVE' AND accountnumber != $2
                `;
                const transactionResult = await pg.query(transactionQuery, [tx.cashref, defaultCashAccount]);
                const transactionDetails = transactionResult.rows;
    
                for (let transaction of transactionDetails) {
                    let accountName = 'Unknown';
                    const { whichaccount, accountnumber } = transaction;
    
                    if (whichaccount === 'PERSONAL') {
                        const { rows: orgSettings } = await pg.query(`SELECT personal_account_prefix FROM sky."Organisationsettings"`);
                        const personalAccountPrefix = orgSettings[0].personal_account_prefix;
                        const phone = accountnumber.replace(personalAccountPrefix, '');
                        const { rows: users } = await pg.query(`SELECT firstname, lastname, othernames FROM sky."User" WHERE phone = $1`, [phone]);
                        if (users.length > 0) {
                            const { firstname, lastname, othernames } = users[0];
                            accountName = `${firstname} ${lastname} ${othernames}`.trim();
                        }
                    } else if (whichaccount === 'SAVINGS') {
                        const { rows: savings } = await pg.query(`SELECT userid FROM sky."savings" WHERE accountnumber = $1`, [accountnumber]);
                        if (savings.length > 0) {
                            const { userid: savingsUserId } = savings[0];
                            const { rows: users } = await pg.query(`SELECT firstname, lastname, othernames FROM sky."User" WHERE id = $1`, [savingsUserId]);
                            if (users.length > 0) {
                                const { firstname, lastname, othernames } = users[0];
                                accountName = `${firstname} ${lastname} ${othernames}`.trim();
                            }
                        }
                    } else if (whichaccount === 'LOAN') {
                        const { rows: loans } = await pg.query(`SELECT userid FROM sky."loanaccounts" WHERE accountnumber = $1`, [accountnumber]);
                        if (loans.length > 0) {
                            const { userid: loanUserId } = loans[0];
                            const { rows: users } = await pg.query(`SELECT firstname, lastname, othernames FROM sky."User" WHERE id = $1`, [loanUserId]);
                            if (users.length > 0) {
                                const { firstname, lastname, othernames } = users[0];
                                accountName = `${firstname} ${lastname} ${othernames}`.trim();
                            }
                        }
                    } else if (whichaccount === 'GLACCOUNT') {
                        accountName = 'SYSTEM AUTOMATION';
                    }
    
                    user.transactions.add(JSON.stringify({
                        accountnumber: transaction.accountnumber,
                        accountname: accountName,
                        accounttype: transaction.whichaccount,
                        tfrom: transaction.tfrom,
                        credit: parseFloat(transaction.credit || 0)
                    }));
                }
            }
    
            // Calculate remitted per user
            for (const [userId, refs] of Object.entries(userTransactionRefs)) {
                if (refs.length === 0) continue;
    
                // Remove duplicates by using Set
                const uniqueRefs = Array.from(new Set(refs));
    
                const bankTxQuery = `
                    SELECT credit, debit FROM sky."banktransaction"
                    WHERE transactionref = ANY($1) AND status = 'ACTIVE'
                `;
                const bankTxResult = await pg.query(bankTxQuery, [uniqueRefs]);
                const bankTransactions = bankTxResult.rows;
    
                const remitted = bankTransactions.reduce((sum, btx) => sum + (parseFloat(btx.credit || 0) - parseFloat(btx.debit || 0)), 0);
    
                userCollections[userId].remitted += remitted;
            }
    
            // Convert Set to Array for transactions
            Object.values(userCollections).forEach(user => {
                user.transactions = Array.from(user.transactions).map(tx => JSON.parse(tx));
            });
            
            // Calculate excess and balance for each user
            Object.values(userCollections).forEach(user => {
                const net = user.collected - user.remitted;
                if (net > 0) {
                    user.balance = net;
                } else {
                    user.excess = Math.abs(net);
                }
            });
    
            await activityMiddleware(req, user.id, 'Collections for the day retrieved successfully', 'VIEW_COLLECTIONS_FOR_THE_DAY');
    
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Collections for the day retrieved successfully",
                statuscode: StatusCodes.OK,
                data: Object.values(userCollections),
                errors: []
            });
    
        } catch (error) {
            console.error('Unexpected Error:', error);
            await activityMiddleware(req, user.id, 'An unexpected error occurred fetching collections for the day', 'VIEW_COLLECTIONS_FOR_THE_DAY');
    
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "An unexpected error occurred",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: [error.message]
            });
        } 
    };
    
    module.exports = { viewCollectionsForTheDay };
 