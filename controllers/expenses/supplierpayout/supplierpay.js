const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { performTransaction } = require("../../../middleware/transactions/performTransaction");

const processSupplierPayout = async (req, res) => {
    const { supplier, amount, description, tfrom } = req.body;
    const user = req.user

    if (!supplier || !amount || !description || !tfrom) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Supplier, amount, description, and payment method are required.",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        // Check if the supplier exists
        const supplierQuery = `SELECT * FROM skyeu."Supplier" WHERE id = $1 AND status = 'ACTIVE'`;
        const { rows: [validSupplier] } = await pg.query(supplierQuery, [supplier]);

        if (!validSupplier) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Supplier does not exist.",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        // Further processing logic for supplier payout can be added here
        const organisationQuery = `SELECT * FROM skyeu."Organisationsettings" WHERE status = 'ACTIVE'`;
        const { rows: [organisationData] } = await pg.query(organisationQuery);

        if (!organisationData) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Organisation data not found.",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        const transactionQuery = `
            SELECT 
                COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) AS balance
            FROM skyeu."transaction"
            WHERE accountnumber = $1 AND userid = $2 AND tfrom = $3 AND status = 'ACTIVE'
        `;
        const { rows: [transactionData] } = await pg.query(transactionQuery, [organisationData.default_allocation_account, user.id, tfrom]);

        if (!transactionData) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Transaction data not found.",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        const balance = transactionData.balance;

        if (amount > balance) { 
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Insufficient allocated funds at "+tfrom,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["The payout amount exceeds the available balance."]
            });
        }

        const fromTransaction = {
            accountnumber: `${organisationData.default_allocation_account}`,
            credit: 0,
            debit: amount,
            reference: "",
            transactiondate: new Date(),
            transactiondesc: description,
            currency: validSupplier.currency,
            description: `Debit for supplier, payout to ${validSupplier.supplier} ${description}`,
            branch: user.branch,
            registrationpoint: null,
            ttype: 'DEBIT',
            tfrom,
            tax: false,
        };

        const toTransaction = {
            accountnumber: `${organisationData.personal_account_prefix}${validSupplier.contactpersonphone}`,
            credit: amount,
            debit: 0,
            reference: "",
            transactiondate: new Date(),
            transactiondesc: description,
            currency: validSupplier.currency,
            description: `Credit for supplier payout by ${user.firstname} ${user.lastname} ${description}`,
            branch: null,
            registrationpoint: null,
            ttype: 'CREDIT',
            tfrom,
            tax: false,
        };

        const makePayment = await performTransaction(fromTransaction, toTransaction, user.id, user.id);

        if (!makePayment) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Payment could not be completed.",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["The transaction failed to process."]
            });
        }



        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Supplier payout processed successfully.",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred.",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { processSupplierPayout };
