const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

const reversePayment = async (req, res) => {
    const { reference } = req.body;

    if (!reference) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Reference is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: '',
            errors: ["Reference is required"]
        });
    }

    // Extract the part of the reference needed for the query
    const referenceParts = reference.split('|');
    const requiredReference = referenceParts[1]; // S-1736958501024

    try {
        
        // Update the transaction status to 'REVERSED' in the database
        const result = await pg.query(
            `UPDATE sky."transaction" SET status = 'REVERSED' WHERE reference LIKE '%' || $1 || '%'`,
            [requiredReference]
        );

        if (result.rowCount === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Transaction not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: '',
                errors: ["Transaction not found"]
            });
        }

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Transaction reversed successfully",
            statuscode: StatusCodes.OK,
            data: result.rows[0],
            errors: []
        });
    } catch (error) {
        console.error('Error reversing transaction:', error);

        // Return error response
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An error occurred while reversing the transaction",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: '',
            errors: [error.message]
        });
    }
};

module.exports = { reversePayment };
