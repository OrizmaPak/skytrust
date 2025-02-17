const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

async function approveDeclineLoanProduct(req, res) {
    const { id, status } = req.body;

    const errors = [];

    const addError = (field, message) => {
        errors.push({ field, message });
    };

    // Validate id
    if (!id) {
        addError('id', 'ID is required');
    }

    // Validate status
    const validStatuses = ["ACTIVE", "DECLINED"];
    if (!status || !validStatuses.includes(status)) {
        addError('status', 'Valid status is required');
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
        const existingLoanProductQuery = `SELECT * FROM sky."loanproduct" WHERE id = $1`;
        const existingLoanProductResult = await pg.query(existingLoanProductQuery, [id]);

        if (existingLoanProductResult.rows.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Loan product with the provided ID does not exist",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        const updateLoanProductQuery = `
            UPDATE sky."loanproduct" SET
                status = $1
            WHERE id = $2
            RETURNING *
        `;

        const updateValues = [status, id];

        const updatedLoanProduct = await pg.query(updateLoanProductQuery, updateValues);

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Loan product status updated successfully",
            statuscode: StatusCodes.OK,
            data: updatedLoanProduct.rows[0],
            errors: []
        });

    } catch (err) {
        console.error('Unexpected Error:', err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}

module.exports = { approveDeclineLoanProduct };
