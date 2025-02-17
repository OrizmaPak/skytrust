const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

// Function to create or update an account
const createOrUpdateAccount = async (req, res) => {
    const { id, accounttype, groupname, description } = req.body;
    const user = req.user;

    try {
        // Fetch organisation settings
        const { rows: orgSettingsRows } = await pg.query(`SELECT * FROM sky."Organisationsettings" WHERE id = 1`);
        const orgSettings = orgSettingsRows[0];

        // Check if organisation settings exist
        if (!orgSettings) {
            await activityMiddleware(req, user.id, 'Organisation settings not found', 'ACCOUNT');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Organisation settings not found",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: []
            });
        }

        let accountnumber;
        if (id) {
            // Fetch existing account details
            const { rows: existingAccountRows } = await pg.query(`SELECT * FROM sky."Accounts" WHERE id = $1`, [id]);
            if (existingAccountRows.length === 0) {
                await activityMiddleware(req, user.id, 'Account not found', 'ACCOUNT');
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Account not found",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }
            const existingAccount = existingAccountRows[0];
            accountnumber = existingAccount.accountnumber;

            // Ensure account type is not changed during update
            if (accounttype && accounttype !== existingAccount.accounttype) {
                await activityMiddleware(req, user.id, 'Account type cannot be changed', 'ACCOUNT');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Account type cannot be changed",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        } else {
            // Determine the prefix based on account type
            let prefix;
            switch (accounttype) {
                case "CASH":
                    prefix = orgSettings.cash_account_prefix;
                    break;
                case "ASSET":
                    prefix = orgSettings.asset_account_prefix;
                    break; 
                case "CURRENT ASSETS":
                    prefix = orgSettings.current_assets_account_prefix;
                    break;
                case "EXPENSE":
                    prefix = orgSettings.expense_account_prefix;
                    break;
                case "INCOME":
                    prefix = orgSettings.income_account_prefix;
                    break;
                case "EQUITY RETAINED EARNINGS":
                    prefix = orgSettings.equity_retained_earnings_account_prefix;
                    break;
                case "EQUITY DOES NOT CLOSE":
                    prefix = orgSettings.equity_does_not_close_prefix;
                    break;
                case "INVENTORY":
                    prefix = orgSettings.inventory_account_prefix;
                    break;
                case "OTHER ASSET":
                    prefix = orgSettings.other_asset_account_prefix;
                    break;
                case "COST OF SALES":
                    prefix = orgSettings.cost_of_sales_account_prefix;
                    break;
                case "FIXED ASSET":
                    prefix = orgSettings.fixed_asset_account_prefix;
                    break;
                case "OTHER CURRENT ASSET":
                    prefix = orgSettings.other_current_asset_account_prefix;
                    break;
                case "ACCOUNTS PAYABLE":
                    prefix = orgSettings.accounts_payable_account_prefix;
                    break;
                case "ACCOUNTS RECEIVABLE":
                    prefix = orgSettings.accounts_receivable_account_prefix;
                    break;
                case "ACCUMULATED DEPRECIATION":
                    prefix = orgSettings.accumulated_depreciation_account_prefix;
                    break;
                case "LIABILITIES":
                    prefix = orgSettings.liabilities_account_prefix;
                    break;
                case "OTHER CURRENT LIABILITIES":
                    prefix = orgSettings.other_current_liabilities_account_prefix;
                    break;
                case "LONG TERM LIABILITIES":
                    prefix = orgSettings.long_term_liabilities_account_prefix;
                    break;
                case "EQUITY":
                    prefix = orgSettings.equity_account_prefix;
                    break;
                default:
                    await activityMiddleware(req, user.id, 'Invalid account type', 'ACCOUNT');
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: "Invalid account type",
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: []
                    });
            }

            // Check if prefix is set for the account type
            if (!prefix) {
                await activityMiddleware(req, user.id, `Prefix for ${accounttype} account type has not been set`, 'ACCOUNT');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Prefix for ${accounttype} account type has not been set`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            // Generate account number
            const { rows: accountRows } = await pg.query(`SELECT accountnumber FROM sky."Accounts" WHERE accountnumber LIKE '${prefix}%' ORDER BY accountnumber DESC LIMIT 1`);
            
            // If no existing account numbers with the prefix, start with the first account number
            if (accountRows.length === 0) {
                accountnumber = `${prefix}${'0'.repeat(10 - prefix.toString().length - 1)}1`;
            } else {
                // Increment the highest account number by 1
                const highestAccountNumber = accountRows[0].accountnumber;
                const newAccountNumber = parseInt(highestAccountNumber) + 1;
                
                // Ensure the new account number starts with the prefix
                if (newAccountNumber.toString().startsWith(prefix)) {
                    accountnumber = newAccountNumber.toString();
                } else {
                    await activityMiddleware(req, user.id, `More accounts cannot be opened with the prefix ${prefix}. Please update the prefix to start a new account run.`, 'ACCOUNT');
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: `More accounts cannot be opened with the prefix ${prefix}. Please update the prefix to start a new account run.`,
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: []
                    });
                }
            }

            // Check if the generated account number already exists
            const { rows: existingAccountRows } = await pg.query(`SELECT * FROM sky."Accounts" WHERE accountnumber = $1`, [accountnumber]);
            if (existingAccountRows.length > 0) {
                await activityMiddleware(req, user.id, 'Generated account number already exists. Please try again.', 'ACCOUNT');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Generated account number already exists. Please try again.",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }

        // Insert or update account in the database
        if (id) {
            // Update existing account
            await pg.query(`UPDATE sky."Accounts" SET groupname = $1, description = $2, dateadded = $3, createdby = $4 WHERE id = $5`, 
                [groupname, description, new Date(), user.id, id]);
            await activityMiddleware(req, user.id, 'Account updated successfully', 'ACCOUNT');
        } else {
            // Create new account
            await pg.query(`INSERT INTO sky."Accounts" (accountnumber, groupname, accounttype, description, status, dateadded, createdby) VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6)`, 
                [accountnumber, groupname, accounttype, description, new Date(), user.id]);
            await activityMiddleware(req, user.id, 'Account created successfully', 'ACCOUNT');
        }

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: id ? "Account updated successfully" : "Account created successfully",
            statuscode: StatusCodes.OK,
            data: id ? {} : { accountnumber },
            errors: []
        });
    } catch (error) {
        // Handle unexpected errors
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred', 'ACCOUNT');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { createOrUpdateAccount };

