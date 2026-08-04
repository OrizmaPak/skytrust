const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");
const { activityMiddleware } = require("../../middleware/activity");

const normalizeDescription = (value) => {
    const description = String(value || '').trim();
    return description || null;
};

const makeReversalReference = (transaction) => {
    const base = transaction.reference || transaction.transactionref || transaction.cashref || `TX-${transaction.id}`;
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    return `REV-${base}-${suffix}`.slice(0, 120);
};

const reverseTransaction = async (req, res) => {
    const user = req.user;
    const id = req.params.id || req.body?.id;
    const description = normalizeDescription(req.body?.description);

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Transaction id is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        const reversedTransaction = await pg.withTransaction(async (client) => {
            const { rows: [original] } = await client.query(
                `SELECT *
                 FROM skytobi."transaction"
                 WHERE id = $1
                 FOR UPDATE`,
                [id]
            );

            if (!original) {
                const error = new Error("Transaction not found");
                error.statusCode = StatusCodes.NOT_FOUND;
                throw error;
            }

            if (original.status !== 'ACTIVE') {
                const error = new Error("Only active transactions can be reversed");
                error.statusCode = StatusCodes.BAD_REQUEST;
                throw error;
            }

            const credit = Number(original.credit) || 0;
            const debit = Number(original.debit) || 0;

            if (credit <= 0 && debit <= 0) {
                const error = new Error("Transaction has no credit or debit amount to reverse");
                error.statusCode = StatusCodes.BAD_REQUEST;
                throw error;
            }

            if (credit > 0 && debit > 0) {
                const error = new Error("Transactions with both credit and debit amounts cannot be reversed here");
                error.statusCode = StatusCodes.BAD_REQUEST;
                throw error;
            }

            if ((original.reference || '').startsWith('REV-')) {
                const error = new Error("Reversal transactions cannot be reversed here");
                error.statusCode = StatusCodes.BAD_REQUEST;
                throw error;
            }

            const { rows: existingReversals } = await client.query(
                `SELECT id
                 FROM skytobi."transaction"
                 WHERE transactionref = $1
                   AND status = 'ACTIVE'
                   AND reference LIKE 'REV-%'
                 LIMIT 1`,
                [`REVERSAL-OF-${original.id}`]
            );

            if (existingReversals.length) {
                const error = new Error("This transaction has already been reversed");
                error.statusCode = StatusCodes.CONFLICT;
                throw error;
            }

            const reversalCredit = debit > 0 ? debit : 0;
            const reversalDebit = credit > 0 ? credit : 0;
            const reversalDescription = description || `Reversal of transaction ${original.reference || original.id}`;
            const reversalReference = makeReversalReference(original);
            const now = new Date();

            const { rows: [reversal] } = await client.query(
                `INSERT INTO skytobi."transaction"
                 (accountnumber, userid, currency, credit, debit, description, image, branch,
                  registrationpoint, approvedby, status, transactiondate, transactiondesc,
                  transactionref, cashref, updatedby, ttype, tfrom, createdby, valuedate,
                  reference, whichaccount, voucher, tax)
                 VALUES
                 ($1, $2, $3, $4, $5, $6, $7, $8,
                  $9, $10, 'ACTIVE', $11, $12,
                  $13, $14, $15, $16, $17, $18, $19,
                  $20, $21, $22, $23)
                 RETURNING *`,
                [
                    original.accountnumber,
                    original.userid,
                    original.currency || 'USD',
                    reversalCredit,
                    reversalDebit,
                    reversalDescription,
                    original.image,
                    original.branch,
                    original.registrationpoint,
                    user.id,
                    now,
                    `Reversal of transaction ${original.id}: ${original.transactiondesc || original.description || ''}`.trim(),
                    `REVERSAL-OF-${original.id}`,
                    original.cashref || '',
                    user.id,
                    reversalCredit > 0 ? 'CREDIT' : 'DEBIT',
                    original.tfrom,
                    user.id,
                    now,
                    reversalReference,
                    original.whichaccount,
                    original.voucher || '',
                    original.tax || false
                ]
            );

            return reversal;
        });

        try {
            await activityMiddleware(req, user.id, `Transaction ${id} reversed successfully`, 'TRANSACTION');
        } catch (activityError) {
            console.error('Unable to log transaction reversal activity:', activityError);
        }

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Transaction reversed successfully",
            statuscode: StatusCodes.OK,
            data: reversedTransaction,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);

        try {
            await activityMiddleware(req, user.id, `An unexpected error occurred reversing transaction ${id}`, 'TRANSACTION');
        } catch (activityError) {
            console.error('Unable to log failed transaction reversal activity:', activityError);
        }

        const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;

        return res.status(statusCode).json({
            status: false,
            message: error.statusCode ? error.message : "An unexpected error occurred",
            statuscode: statusCode,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { reverseTransaction };
