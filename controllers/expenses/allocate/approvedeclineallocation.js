const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const approveDeclineAllocation = async (req, res) => {
    try {
        const { reference, status } = req.body;

        if (!reference || !status) {
            await activityMiddleware(req, 0, 'Validation failed: Reference and status are required', 'APPROVE_DECLINE_ALLOCATION');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Reference and status are required",
                statuscode: StatusCodes.BAD_REQUEST, 
                data: null,
                errors: []
            });
        }

        if (status === 'ACTIVE') {
            const updateStatusQuery = `
                UPDATE skyeu."transaction"
                SET status = 'ACTIVE'
                WHERE reference = $1
            `;
            const updateResult = await pg.query(updateStatusQuery, [reference]);

            if (updateResult.rowCount === 0) {
                await activityMiddleware(req, 0, 'Failed to update transaction status to ACTIVE', 'APPROVE_DECLINE_ALLOCATION');
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Transaction not found",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }

            await activityMiddleware(req, 0, `Transaction status updated to ACTIVE for reference ${reference}`, 'APPROVE_DECLINE_ALLOCATION');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Transaction status updated to ACTIVE",
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            });
        } else if (status === 'DECLINED') {
            const splitReference = reference.split('|');
            if (splitReference.length < 2) {
                await activityMiddleware(req, 0, 'Invalid reference format', 'APPROVE_DECLINE_ALLOCATION');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Invalid reference format",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            console.log('splitReference', splitReference[1]);

            const searchValue = splitReference[1];
            const findTransactionsQuery = `
                SELECT * FROM skyeu."transaction"
                WHERE reference LIKE $1
            `;
            const transactionsResult = await pg.query(findTransactionsQuery, [`%|${searchValue}%`]);

            console.log('transactionsResult', transactionsResult.rows);

            if (transactionsResult.rows.length < 2) {
                await activityMiddleware(req, 0, 'Matching transactions not found', 'APPROVE_DECLINE_ALLOCATION');
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Matching transactions not found",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }



            const matchingTransactions = transactionsResult.rows.filter(transaction => {
                const transactionSplit = transaction.reference.split('|');
                return transactionSplit.length > 1 && transactionSplit[1] == searchValue;
            });

            if (matchingTransactions.length < 2) {
                await activityMiddleware(req, 0, 'Matching transactions not found', 'APPROVE_DECLINE_ALLOCATION');
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Matching transactions not found",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }

            for (const transaction of matchingTransactions) {
                const updateTransactionStatusQuery = `
                    UPDATE skyeu."transaction"
                    SET status = 'DECLINED'
                    WHERE reference = $1
                `;
                await pg.query(updateTransactionStatusQuery, [transaction.reference]);
            }

            await activityMiddleware(req, 0, `Transactions with reference part ${searchValue} found and processed`, 'APPROVE_DECLINE_ALLOCATION');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Transactions processed successfully",
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            });
        } else {
            await activityMiddleware(req, 0, 'Invalid status provided', 'APPROVE_DECLINE_ALLOCATION');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Invalid status provided",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }
    } catch (error) {
        console.error('Error in approve/decline allocation:', error);
        await activityMiddleware(req, 0, 'Internal Server Error during approve/decline allocation', 'APPROVE_DECLINE_ALLOCATION');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

module.exports = approveDeclineAllocation;
