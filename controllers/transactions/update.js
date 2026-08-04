const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");
const { activityMiddleware } = require("../../middleware/activity");

const optionalDate = value => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
};

const optionalAmount = value => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const updateTransaction = async (req, res) => {
    const user = req.user;
    const id = req.params.id || req.body.id;

    if (!id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Transaction id is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    const credit = optionalAmount(req.body.credit);
    const debit = optionalAmount(req.body.debit);
    const transactiondate = optionalDate(req.body.transactiondate);
    const valuedate = optionalDate(req.body.valuedate);
    const description = req.body.description === undefined ? null : req.body.description;

    if ([credit, debit, transactiondate, valuedate].some(value => value === undefined)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Please enter valid credit, debit, transaction date and value date values",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        const { rows } = await pg.query(
            `UPDATE skytobi."transaction"
             SET credit = COALESCE($1, credit),
                 debit = COALESCE($2, debit),
                 transactiondate = COALESCE($3, transactiondate),
                 valuedate = COALESCE($4, valuedate),
                 description = COALESCE($5, description)
             WHERE id = $6
             RETURNING *`,
            [credit, debit, transactiondate, valuedate, description, id]
        );

        if (!rows.length) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Transaction not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        await activityMiddleware(req, user.id, `Transaction ${id} updated successfully`, 'TRANSACTION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Transaction updated successfully",
            statuscode: StatusCodes.OK,
            data: rows[0],
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, `An unexpected error occurred updating transaction ${id}`, 'TRANSACTION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { updateTransaction };
