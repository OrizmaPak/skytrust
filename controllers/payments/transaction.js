const { StatusCodes } = require('http-status-codes');
const pg = require('../../db/pg');
const { saveTransaction } = require('../../utils/transactionHelper');
const { generateTextwithClient } = require('../ai/ai');

const handleTransaction = async (req, res) => {
    console.log('entering handleTransaction', req.body);

    const respondWithError = (status, message, errors = []) => {
        return res.status(status).json({
            status: false,
            message,
            data: null,
            statuscode: status,
            errors
        });
    };

    const respondWithSuccess = async (message, reference) => {
        console.log('Header in code', req.headers);
        // const details = await generateTextwithClient(`${req.body.transactiondesc}... make a simple statement out of this.`, req);
        return res.status(StatusCodes.OK).json({
            status: true,
            message,
            data: {
                // rawdetails: req.body.transactiondesc,
                details: req.body.transactiondesc,
                reference
            },
            statuscode: StatusCodes.OK,
            errors: []
        });
    };

    if (req.transactionError) {
        const { status, message, errors } = req.transactionError;
        return respondWithError(status, message, errors);
    }

    if (!req.body.reference) {
        if (req.body.tfrom == 'BANK') {
            const excessAccountNumber = req.orgSettings.default_excess_account;
            req.body.transactiondesc += `Original Account Number: ${req.body.accountnumber}, Description: ${req.body.description}, Branch: ${req.body.branch}, Registration Point: ${req.body.registrationpoint}`;
            await saveTransaction(pg, req, res, excessAccountNumber, req.body.credit, req.body.debit, req.body.description, req.body.ttype, 'PENDING', 'EXCESS', req.user.id);
            await pg.query('COMMIT');
            return respondWithSuccess('Transaction saved to excess account.', req.body.reference);
        } else {
            await pg.query('ROLLBACK');
            return respondWithError(StatusCodes.INTERNAL_SERVER_ERROR, 'Internal error, please contact support.');
        }
    }

    try {
        const queryResult = await pg.query('SELECT * FROM sky."transaction" WHERE reference = $1', [req.body.reference]);
        if (queryResult.rowCount === 0) {
            return respondWithError(StatusCodes.NOT_FOUND, 'Transaction Failed.');
        }
        return respondWithSuccess('Transaction successful.', req.body.reference);
    } catch (error) {
        console.error('Error in handleTransaction:', error);
        return respondWithError(StatusCodes.INTERNAL_SERVER_ERROR, 'Internal error, please contact support.', [error.message]);
    }
};

module.exports = {
    handleTransaction
};


 