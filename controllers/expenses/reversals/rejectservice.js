const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { performTransactionOneWay } = require("../../../middleware/transactions/performTransaction");

const rejectService = async (req, res) => {
    const { id, amount, staff, issue } = req.body;
    const user = req.user;

    try {
        // Fetch the service using the provided id
        const serviceQuery = `SELECT * FROM skyeu."Service" WHERE id = $1`;
        const { rows: [service] } = await pg.query(serviceQuery, [id]);

        if (!service) {
            await activityMiddleware(req, user.id, 'Service not found', 'SERVICE_REJECTION');
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Service not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Service with the given ID does not exist"]
            });
        }

        if (service.status !== "ACTIVE") {
            await activityMiddleware(req, user.id, 'Service not active', 'SERVICE_REJECTION');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "This Service has not been paid for.",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Service with the given ID is not active"]
            });
        }

        // Clone the service object
        const clonedService = { ...service };

        // Update the clone with the negative amount and new issue
        if (Math.abs(amount) > Math.abs(clonedService.amount)) {
            await activityMiddleware(req, user.id, 'Amount exceeds original service amount', 'SERVICE_REJECTION');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "The rejection amount cannot exceed the original service amount",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Rejection amount exceeds original service amount"]
            });
        }
        clonedService.amount = -Math.abs(amount);
        clonedService.issue = issue;

        // Check if staff is provided and exists in the User table
        let staffphone;
        if (staff) {
            const staffQuery = `SELECT * FROM skyeu."User" WHERE id = $1`;
            const { rows: [staffMember] } = await pg.query(staffQuery, [staff]);
            
            if (!staffMember) {
                await activityMiddleware(req, user.id, 'Staff not found', 'SERVICE_REJECTION');
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Staff not found",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: ["Staff with the given ID does not exist"]
                });
            }
            staffphone = staffMember.phone;
            // Update the clone with the staff
            clonedService.staff = staff;
        }

        // Get the organisation settings
        const { rows: [organisationSettings] } = await pg.query(`SELECT * FROM skyeu."Organisationsettings"`);
        if (!organisationSettings) {
            await activityMiddleware(req, user.id, 'Organisation settings not found', 'SERVICE_REJECTION');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Organisation settings not found",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["Organisation settings not found"]
            });
        }

        const phonenumber = staff ? staffphone : service.supplier;

        const transaction = {
            accountnumber: `${organisationSettings.personal_account_prefix}${phonenumber}`,
            credit: staff ? 0 : Math.abs(clonedService.amount),
            debit: staff ? Math.abs(clonedService.amount) : 0,
            reference: clonedService.reference,
            transactiondate: new Date(),
            transactiondesc: 'Service Rejection',
            currency: service.currency || "USD",
            description: `Rejection of service ${service.servicetype} by ${user.firstname} ${user.lastname} because: ${issue}`,
            branch: user.branch,
            registrationpoint: null,
            ttype: staff ? 'DEBIT' : 'CREDIT',
            tfrom: 'SERVICE',
            tax: false,
        };

        const debitTransaction = await performTransactionOneWay(transaction);

        if (!debitTransaction) {
            console.error('Transaction failed: Unable to process service rejection');
            await activityMiddleware(req, user.id, 'Transaction failed: Unable to process service rejection', 'SERVICE_REJECTION');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Transaction failed: Unable to process service rejection",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["Transaction failed: Unable to process service rejection"]
            });
        }

        // Insert the cloned service into the database
        const insertQuery = `
            INSERT INTO skyeu."Service" (serviceid, supplier, staff, servicetype, description, amount, amountfrom, amountto, servicestartdate, serviceenddate, branch, dateadded, createdby, issue, reference, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *;
        `;
        const values = [
            clonedService.serviceid,
            clonedService.supplier,
            clonedService.staff,
            clonedService.servicetype,
            clonedService.description,
            clonedService.amount,
            clonedService.amountfrom,
            clonedService.amountto,
            clonedService.servicestartdate,
            clonedService.serviceenddate,
            clonedService.branch,
            clonedService.dateadded,
            clonedService.createdby,
            clonedService.issue,
            clonedService.reference,
            clonedService.status
        ];

        const { rows: [newService] } = await pg.query(insertQuery, values);

        await activityMiddleware(req, user.id, 'Service rejected and cloned successfully', 'SERVICE_REJECTION');

        return res.status(StatusCodes.CREATED).json({
            status: true,
            message: "Service rejected and cloned successfully",
            statuscode: StatusCodes.CREATED,
            data: newService,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred during service rejection', 'SERVICE_REJECTION');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { rejectService };
