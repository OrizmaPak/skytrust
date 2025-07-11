const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const saveOrUpdateServices = async (req, res) => {
    const user = req.user;
    const { rowsize, supplier, branch } = req.body;

    if (!rowsize) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid input data",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }
    const supplierQuery = `SELECT * FROM skyeu."Supplier" WHERE id = $1 AND status = 'ACTIVE'`;
    const { rows: [validSupplier] } = await pg.query(supplierQuery, [supplier]);

    if (!validSupplier) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Invalid supplier for service `,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }
    const branchQuery = `SELECT * FROM skyeu."Branch" WHERE id = $1 AND status = 'ACTIVE'`;
    const { rows: [validbranch] } = await pg.query(branchQuery, [branch]);

    if (!validbranch) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Invalid branch for service `,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    const reference = `SO-${new Date().getTime().toString()}`;

    await pg.query('BEGIN');

    try {
        for (let i = 0; i < rowsize; i++) {
            const validServiceTypes = ["LOGISTICS", "IT", "NETWORK", "OTHER", "MAINTENANCE"];
            const serviceType = req.body[`servicetype${i+1}`];

            if (!validServiceTypes.includes(serviceType)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Invalid service type: ${serviceType}. Must be one of ${validServiceTypes.join(", ")}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
            // Insert new service
            const insertQuery = `
                INSERT INTO skyeu."Service" (supplier, servicetype, description, amount, amountfrom, amountto, 
                    servicestartdate, serviceenddate, branch, dateadded, createdby, status, reference)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, NOW(), $8, $9, $10)
            `;
            await pg.query(insertQuery, [supplier, req.body[`servicetype${i+1}`], req.body[`description${i+1}`], req.body[`amount${i+1}`], req.body[`amountfrom${i+1}`], req.body[`amountto${i+1}`], branch, user.id, 'SO', reference]);
        }

        if (req.body.reference) {
            await pg.query(
                `DELETE FROM skyeu."Service" WHERE reference = $1`, 
                [req.body.reference]
            );
        }

        await pg.query('COMMIT');
        await activityMiddleware(req, user.id, 'Services processed successfully', 'SERVICE');
        return res.status(StatusCodes.OK).json({
            status: true,
            message: req.body.reference ? "Services Order updated successfully" : "Services Order processed successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred while processing services', 'SERVICE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
}

module.exports = {saveOrUpdateServices}