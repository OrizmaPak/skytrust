const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { performTransaction, performTransactionOneWay } = require("../../../middleware/transactions/performTransaction");

const manageReceiveService = async (req, res) => {
    const user = req.user;
    const { rowsize, supplier, branch, reference, tfrom } = req.body;

    if (!rowsize || !reference || !tfrom) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid reference, payment method or data size provided. Please verify your input.",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }
    const supplierQuery = `SELECT * FROM sky."Supplier" WHERE id = $1 AND status = 'ACTIVE'`;
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
    const branchQuery = `SELECT * FROM sky."Branch" WHERE id = $1 AND status = 'ACTIVE'`;
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

    const referenceExistsQuery = `SELECT COUNT(*) FROM sky."Service" WHERE reference = $1`;
    const { rows: [{ count: referenceCount }] } = await pg.query(referenceExistsQuery, [req.body.reference]);

    if (referenceCount < 1) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "The Service you are trying to access has not been ordered for",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    let totalValue = 0;
    await pg.query('BEGIN');
    try {
        for (let i = 0; i < rowsize; i++) {
            const validServiceTypes = ["LOGISTICS", "IT", "NETWORK", "OTHER", "MAINTENANCE"];
            const serviceType = req.body[`servicetype${i+1}`];
            const description = req.body[`description${i+1}`];
            const servicestartdate = req.body[`servicestartdate${i+1}`];
            const serviceenddate = req.body[`serviceenddate${i+1}`];
            const otherdetails = req.body[`otherdetails${i+1}`];



            if (!validServiceTypes.includes(serviceType)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Invalid service type: ${serviceType}. Must be one of ${validServiceTypes.join(", ")}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            if (!description || !servicestartdate || !serviceenddate || !otherdetails) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Description, service start date, otherdetails and service end date must be provided",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            } 

            if (req.body[`amount${i+1}`] && req.body[`amountto${i+1}`] && Number(req.body[`amount${i+1}`]) > Number(req.body[`amountto${i+1}`])) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Amount for service cannot exceed the specified amountto value;  you inputed ${req.body[`amount${i+1}`]} and this is your amount to ${req.body[`amountto${i+1}`]} `,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            totalValue = totalValue + Number(req.body[`amount${i+1}`]);

            // Insert new service
            const insertQuery = `
                INSERT INTO sky."Service" (supplier, servicetype, description, otherdetails, amount, amountfrom, amountto, 
                    servicestartdate, serviceenddate, branch, dateadded, createdby, status, reference)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13)
            `;
            await pg.query(insertQuery, [supplier, serviceType, description, otherdetails, req.body[`amount${i+1}`], req.body[`amountfrom${i+1}`], req.body[`amountto${i+1}`], servicestartdate, serviceenddate, branch, user.id, 'ACTIVE', reference.replaceAll('SO-', 'RS-')]);
        }

        const organisationData = await pg.query('SELECT * FROM sky."Organisationsettings"');
        
        if (organisationData.rows.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Organisation not found',
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        const orgSettings = organisationData.rows[0];

        if (req.body.reference) {
            await pg.query(
                `DELETE FROM sky."Service" WHERE reference = $1`,
                [req.body.reference]
            );
        } 

        console.log('checking supplier', validSupplier)

        const supplierTransaction = {
            accountnumber: `${orgSettings.personal_account_prefix}${validSupplier.contactpersonphone}`,
            credit: 0,
            debit: totalValue,
            reference: reference.replaceAll('SO-', 'RS-'),
            transactiondate: new Date(),
            transactiondesc: '',
            currency: validSupplier.currency,
            description: "Cost of services received from supplier",
            branch: branch,  
            registrationpoint: null,
            ttype: 'DEBIT',
            tfrom,
            tax: false,
        };

        const debitSupplier = await performTransactionOneWay(supplierTransaction);

        if (!debitSupplier) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Failed to debit supplier account.',
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        const fromTransaction = {
            accountnumber: `${orgSettings.default_allocation_account}`,
            credit: 0,
            debit: req.body.amountpaid,
            reference: reference.replaceAll('SO-', 'RS-'),
            transactiondate: new Date(),
            transactiondesc: '',
            currency: validSupplier.currency,
            description: `Debit for services received from ${validSupplier.supplier}`,
            branch: branch,
            registrationpoint: null,
            ttype: 'DEBIT',
            tfrom,
            tax: false,
        };

        const toTransaction = {
            accountnumber: `${orgSettings.personal_account_prefix}${validSupplier.contactpersonphone}`,
            credit: req.body.amountpaid,
            debit: 0,
            reference: "",
            transactiondate: new Date(),
            transactiondesc: '', 
            currency: validSupplier.currency,
            description: `Credit for services provided by ${user.firstname} ${user.lastname}`,
            branch: branch,
            registrationpoint: null,
            ttype: 'CREDIT',
            tfrom,
            tax: false,
        };

        const makePayment = await performTransaction(fromTransaction, toTransaction, user.id, user.id);

        if (!makePayment) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Failed to process payment for services.",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        

        await activityMiddleware(req, user.id, 'Services processed successfully', 'SERVICE');
        await pg.query('COMMIT');
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Services processed successfully",
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
};

module.exports = { manageReceiveService }


