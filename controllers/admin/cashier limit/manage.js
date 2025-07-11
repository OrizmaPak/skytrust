const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const manageCashierLimit = async (req, res) => {
    try {
        const { id, cashier, depositlimit, withdrawallimit, status } = req.body;

        // Validate required fields
        if (!cashier || !depositlimit || !withdrawallimit) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Cashier, deposit limit, and withdrawal limit are required fields",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Check if the cashier is an actual user
        const { rows: [userExists] } = await pg.query(`SELECT * FROM skyeu."User" WHERE id = $1`, [cashier]);
        if (!userExists) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Cashier is not an actual user",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        // Check if the cashier limit exists
        const { rows: [cashierLimitExists] } = await pg.query(`SELECT * FROM skyeu."Cashierlimit" WHERE cashier = $1`, [cashier]);
        if (cashierLimitExists && !id) {
            return res.status(StatusCodes.CONFLICT).json({
                status: false,
                message: "Cashier limit already exists",
                statuscode: StatusCodes.CONFLICT,
                data: null,
                errors: []
            });
        }

        // If cashier limit ID is provided, update the cashier limit
        if (id) {
            // If status is provided, update only the status
            if (status) {
                const { rows: [updatedCashierLimit] } = await pg.query(`UPDATE skyeu."Cashierlimit" SET status = $1 WHERE id = $2 RETURNING *`, [status, id]);
                if (!updatedCashierLimit) {
                    return res.status(StatusCodes.NOT_FOUND).json({
                        status: false,
                        message: "Cashier limit not found",
                        statuscode: StatusCodes.NOT_FOUND,
                        data: null,
                        errors: []
                    });
                }
                return res.status(StatusCodes.OK).json({
                    status: true,
                    message: "Cashier limit status updated successfully",
                    statuscode: StatusCodes.OK,
                    data: updatedCashierLimit,
                    errors: []
                });
            } else {
                // Update cashier limit details
                const { rows: [updatedCashierLimit] } = await pg.query(`UPDATE skyeu."Cashierlimit" SET depositlimit = $1, withdrawallimit = $2 WHERE id = $3 RETURNING *`, [depositlimit, withdrawallimit, id]);
                if (!updatedCashierLimit) {
                    return res.status(StatusCodes.NOT_FOUND).json({
                        status: false,
                        message: "Cashier limit not found",
                        statuscode: StatusCodes.NOT_FOUND,
                        data: null,
                        errors: []
                    });
                }
                return res.status(StatusCodes.OK).json({
                    status: true,
                    message: "Cashier limit updated successfully",
                    statuscode: StatusCodes.OK,
                    data: updatedCashierLimit,
                    errors: []
                });
            }
        } else {
            // Create new cashier limit
            // const minIntValue = -2147483648;
            // const maxIntValue = 2147483647;

            // if (depositlimit < minIntValue || depositlimit > maxIntValue || withdrawallimit < minIntValue || withdrawallimit > maxIntValue) {
            //     return res.status(StatusCodes.BAD_REQUEST).json({
            //         status: false,
            //         message: `Deposit limit and withdrawal limit must be within the range of a 32-bit integer (${minIntValue} to ${maxIntValue})`,
            //         statuscode: StatusCodes.BAD_REQUEST,
            //         data: null,
            //         errors: []
            //     });
            // }
            console.log([cashier, depositlimit, withdrawallimit, 'ACTIVE', new Date().getTime(), req.user.id])
            const { rows: [newCashierLimit] } = await pg.query(`INSERT INTO skyeu."Cashierlimit" (cashier, depositlimit, withdrawallimit, status, dateadded, createdby) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [cashier, depositlimit, withdrawallimit, 'ACTIVE', new Date(), req.user.id]);
            return res.status(StatusCodes.CREATED).json({
                status: true,
                message: "Cashier limit created successfully",
                statuscode: StatusCodes.CREATED,
                data: newCashierLimit,
                errors: []
            }); 
        }
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

module.exports = {
    manageCashierLimit
};

