const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getAllPayables = async (req, res) => {
    const user = req.user;

    try {
        // Fetch all suppliers
        const { rows: suppliers } = await pg.query(`SELECT * FROM sky."Supplier"`);

        const results = [];

        // Fetch organisation settings
        const orgSettingsQuery = `SELECT * FROM sky."Organisationsettings" LIMIT 1`;
        const { rows: [orgSettings] } = await pg.query(orgSettingsQuery);

        // Check if organisation settings were retrieved
        if (!orgSettings) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Failed to retrieve organisation settings",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: []
            });
        }

        for (const supplier of suppliers) {
            const contactPhone = supplier.contactpersonphone;

            // Fetch all transactions for the supplier's contact person phone
            const transactionsQuery = `
                SELECT 
                    COALESCE(SUM(credit), 0) AS total_credit, 
                    COALESCE(SUM(debit), 0) AS total_debit
                FROM sky."transaction"
                WHERE accountnumber = $1 AND status = 'ACTIVE'
            `;
            const { rows: [transactionSummary] } = await pg.query(transactionsQuery, [`${orgSettings.personal_account_prefix}${contactPhone}`]);

            const totalCredit = parseFloat(transactionSummary.total_credit);
            const totalDebit = parseFloat(transactionSummary.total_debit);
            const balance = totalCredit - totalDebit;

            if (balance !== 0) {
                results.push({
                    supplier: supplier.supplier,
                    credit: totalCredit,
                    debit: totalDebit,
                    balance: balance
                });
            }
        }

        // Log activity
        await activityMiddleware(req, user.id, 'Payables fetched successfully', 'PAYABLES');

        // Send response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Payables fetched successfully",
            statuscode: StatusCodes.OK,
            data: results,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching payables', 'PAYABLES');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getAllPayables };
