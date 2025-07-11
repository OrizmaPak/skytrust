const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

async function approveDeclineCollateral(req, res) {
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
    if (!status) {
        addError('status', 'Status is required');
    } else if (!validStatuses.includes(status)) {
        addError('status', `Status must be one of the following: ${validStatuses.join(', ')}`);
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
        const existingCollateralQuery = `SELECT * FROM skyeu."collateral" WHERE id = $1`;
        const existingCollateralResult = await pg.query(existingCollateralQuery, [id]);

        if (existingCollateralResult.rows.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Collateral with the provided ID does not exist",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        const updateCollateralQuery = `
            UPDATE skyeu."collateral" SET
                status = $1
            WHERE id = $2
            RETURNING *
        `;

        const updateValues = [status, id];

        const updatedCollateral = await pg.query(updateCollateralQuery, updateValues);

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Collateral status updated successfully",
            statuscode: StatusCodes.OK,
            data: updatedCollateral.rows[0],
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

module.exports = { approveDeclineCollateral };
