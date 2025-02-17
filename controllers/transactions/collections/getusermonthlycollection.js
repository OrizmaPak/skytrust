const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getUserMonthlyCollection = async (req, res) => {
    const user = req.user;
    const { date, userid } = req.query;

    if (!date || !userid) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Date and userid are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Missing date or userid"]
        });
    }

    const [year, month] = date.split('-').map(Number);
    if (!year || !month || month < 1 || month > 12) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid date format. Expected YYYY-MM",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Invalid date format"]
        });
    }

    // Determine number of days in the month
    const daysInMonth = new Date(year, month, 0).getDate();

    let results = [];
    let totalNoOfCollections = 0;
    let totalAmountCollected = 0;
    let totalRemitted = 0;
    let totalExcess = 0;
    let totalToBalance = 0;
    let totalPenalty = 0;

    try {
        // Fetch organisation settings to get default_cash_account
        const orgSettingsQuery = `SELECT default_cash_account FROM sky."Organisationsettings"`;
        const { rows: orgSettings } = await pg.query(orgSettingsQuery);
        const defaultCashAccount = orgSettings[0].default_cash_account;

        // Fetch transactions for the user within the specified month
        const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
        const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0));
        const monthDataQuery = `
                SELECT * FROM sky."transaction"
                WHERE userid = $1
                AND transactiondate >= $2
                AND transactiondate < $3
                AND "cashref" IS NOT NULL
                AND "cashref" <> ''
                AND ttype IN ('CREDIT', 'DEBIT')
                AND status = 'ACTIVE'
                AND accountnumber != $4
        `;
        const monthDataResult = await pg.query(monthDataQuery, [userid, monthStart.toISOString(), monthEnd.toISOString(), defaultCashAccount]);
        const monthData = monthDataResult.rows;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const today = new Date(Date.UTC(year, month - 1, day));
            const yearStr = today.getUTCFullYear();
            const monthStr = String(today.getUTCMonth() + 1).padStart(2, '0');
            const dayStr = String(today.getUTCDate()).padStart(2, '0');
            const dateString = `${yearStr}${monthStr}${dayStr}`;
            const cashRefPrefix = `CR-${dateString}-${userid}`;

            // Filter transactions for the current day using cashref
            const dayData = monthData.filter(tx => tx.cashref.startsWith(cashRefPrefix));
            
            // Calculate number of credit transactions and amount collected
            const creditTransactions = dayData.filter(tx => tx.ttype === 'CREDIT');
            console.log('dayData', day, creditTransactions);
            const noofcollections = creditTransactions.length;
            const amountcollected = creditTransactions.reduce((sum, tx) => sum + (tx.credit || 0), 0);

            // Calculate total debit amount
            const debitSum = dayData.filter(tx => tx.ttype === 'DEBIT').reduce((sum, tx) => sum + (tx.debit || 0), 0);

            // Fetch related bank transactions
            const transactionRefs = dayData.map(tx => tx.cashref).filter(ref => ref);
            let remitted = 0;

            if (transactionRefs.length > 0) {
                const bankTxQuery = `
                    SELECT credit, debit FROM sky."banktransaction"
                    WHERE transactionref = ANY($1) AND status = 'ACTIVE'
                `;
                const bankTxResult = await pg.query(bankTxQuery, [transactionRefs]);
                const bankTransactions = bankTxResult.rows;

                const bankTxSum = bankTransactions.reduce((sum, btx) => sum + ((btx.credit || 0) - (btx.debit || 0)), 0);
                remitted = bankTxSum;
            }
 
            // Calculate penalties
            const penaltyRefs = transactionRefs.map(ref => `${ref}-P`);
            let penaltySum = 0;

            if (penaltyRefs.length > 0) {
                const penaltyQuery = `
                    SELECT debit, credit FROM sky."transaction"
                    WHERE cashref = ANY($1) AND status = 'ACTIVE'
                `;
                const penaltyResult = await pg.query(penaltyQuery, [penaltyRefs]);
                const penaltyTransactions = penaltyResult.rows;

                penaltySum = penaltyTransactions.reduce((sum, ptx) => sum + ((ptx.debit || 0) - (ptx.credit || 0)), 0);
            }

            // Calculate excess and tobalance
            const net = amountcollected - remitted;
            let excess = 0;
            let tobalance = 0;

            if (net > 0) {
                tobalance = net;
            } else {
                excess = Math.abs(net);
            }

            // Update totals
            totalNoOfCollections += noofcollections;
            totalAmountCollected += amountcollected;
            totalRemitted += remitted;
            totalExcess += excess;
            totalToBalance += tobalance;
            totalPenalty += penaltySum;

            results.push({
                day: today.toISOString().split('T')[0], // Format day as YYYY-MM-DD
                noofcollections,
                amountcollected,
                remitted,
                excess,
                tobalance,
                penalty: penaltySum
            });
        }

        const totals = {
            totalNoOfCollections,
            totalAmountCollected,
            totalRemitted,
            totalExcess,
            totalToBalance,
            totalPenalty
        };

        await activityMiddleware(req, user.id, 'User monthly collection fetched successfully', 'USER_MONTHLY_COLLECTION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "User monthly collection fetched successfully",
            statuscode: StatusCodes.OK,
            data: results,
            totals,
            errors: []
        });
    } catch (error) {
        console.error('Error fetching user monthly collection:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching user monthly collection', 'USER_MONTHLY_COLLECTION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getUserMonthlyCollection };
