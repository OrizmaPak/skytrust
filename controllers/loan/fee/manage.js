const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

const manageLoanFee = async (req, res) => {
    const { id, feename, feemethod, chargesbasedon, chargeamount, chargetype, glaccount, status = 'ACTIVE' } = req.body;
    const user = req.user;

    // Basic validation
    const errors = [];

    if (!feename) {
        errors.push({
            field: 'feename',
            message: 'Fee name not found'
        });
    } else if (typeof feename !== 'string' || feename.trim() === '') {
        errors.push({
            field: 'feename',
            message: 'Fee name must be a non-empty string'
        });
    }
 
    if (!feemethod) {
        errors.push({
            field: 'feemethod',  
            message: 'Fee method not found'
        });
    } else if (typeof feemethod !== 'string' || !['FORM FEE', 'PROCESSING FEE', 'INSURANCE FEE', 'DEDUCTION FEE', 'PENALTY'].includes(feemethod)) {
        errors.push({
            field: 'feemethod',
            message: 'Fee method must be one of "FORM FEE", "PROCESSING FEE", "INSURANCE FEE", "DEDUCTION FEE", or "PENALTY"'
        });
    }

    if (!chargesbasedon) {
        errors.push({
            field: 'chargesbasedon',
            message: 'Charges based on not found'
        });
    } else if (typeof chargesbasedon !== 'string' || !['PRINCIPAL AMOUNT ONLY', 'PRINCIPAL AND INTEREST'].includes(chargesbasedon)) {
        errors.push({
            field: 'chargesbasedon',
            message: 'Charges based on must be one of "PRINCIPAL AMOUNT ONLY" or "PRINCIPAL AND INTEREST"'
        });
    }

    if (chargeamount !== undefined && isNaN(parseInt(chargeamount))) {
        errors.push({
            field: 'chargeamount',
            message: 'Charge amount must be a number'
        });
    }

    if (chargetype && typeof chargetype !== 'string') {
        errors.push({
            field: 'chargetype',
            message: 'Charge type must be a string'
        });
    }

    if (!glaccount) {
        errors.push({
            field: 'glaccount',
            message: 'GL account not found'
        });
    } else if (typeof glaccount !== 'string' || glaccount.trim() === '') {
        errors.push({
            field: 'glaccount',
            message: 'GL account must be a non-empty string'
        });
    }

    if (errors.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Validation Errors",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: errors
        });
    }

    try {
        // Check if the provided glaccount exists in the Accounts table
        const accountExistsQuery = {
            text: 'SELECT * FROM skyeu."Accounts" WHERE accountnumber = $1',
            values: [glaccount]
        };
        const { rows: accountExistsRows } = await pg.query(accountExistsQuery);

        if (accountExistsRows.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Invalid glaccount provided',
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        let loanFee;
        if (id) {
            // Update existing loan fee
            const updateLoanFeeQuery = {
                text: `UPDATE skyeu."loanfee" SET 
                        feename = COALESCE($1, feename), 
                        feemethod = COALESCE($2, feemethod), 
                        chargesbasedon = COALESCE($3, chargesbasedon), 
                        chargeamount = COALESCE($4, chargeamount), 
                        chargetype = COALESCE($5, chargetype), 
                        glaccount = COALESCE($6, glaccount), 
                        status = COALESCE($7, status)
                       WHERE id = $8 RETURNING *`,
                values: [feename, feemethod, chargesbasedon, chargeamount, chargetype, glaccount, status, id]
            };
            const { rows: updatedLoanFeeRows } = await pg.query(updateLoanFeeQuery);
            loanFee = updatedLoanFeeRows[0];
        } else {
            // Check if the provided feename already exists in the loanfee table
            const feenameExistsQuery = {
                text: 'SELECT * FROM skyeu."loanfee" WHERE feename = $1',
                values: [feename]
            };
            const { rows: feenameExistsRows } = await pg.query(feenameExistsQuery);

            if (feenameExistsRows.length > 0) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: 'Feename already exists',
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
            // Create new loan fee
            const createLoanFeeQuery = {
                text: `INSERT INTO skyeu."loanfee" (feename, feemethod, chargesbasedon, chargeamount, chargetype, glaccount, status, dateadded, createdby) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8) RETURNING *`,
                values: [feename, feemethod, chargesbasedon, chargeamount, chargetype, glaccount, status, user.id]
            };
            const { rows: createdLoanFeeRows } = await pg.query(createLoanFeeQuery);
            loanFee = createdLoanFeeRows[0];
        }

        res.status(StatusCodes.OK).json({
            status: true,
            message: id ? `Loan fee ${feename} updated successfully` : `Loan fee ${feename} created successfully`,
            statuscode: StatusCodes.OK,
            data: loanFee,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: error.detail,
            errors: []
        });
    }
};
 
module.exports = { manageLoanFee };
