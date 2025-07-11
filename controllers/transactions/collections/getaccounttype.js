const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getAccountType = async (req, res) => {
    const user = req.user;
    let { accountnumber } = req.query;

    if (!accountnumber) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Account number is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    try {
        const { rows: settings } = await pg.query(`
            SELECT savings_account_prefix, personal_account_prefix, loan_account_prefix, rotary_account_prefix
            FROM skyeu."Organisationsettings"
            LIMIT 1
        `);

        if (settings.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Organisational settings not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        const { savings_account_prefix, personal_account_prefix, loan_account_prefix, rotary_account_prefix } = settings[0];
        let accountType = null;
        let accountname;

        if (accountnumber.startsWith(savings_account_prefix)) {
            accountType = "Savings";
            const { rows: accountDetails } = await pg.query(`
                SELECT sa.*, CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS fullname
                FROM skyeu."savings" sa
                JOIN skyeu."User" u ON sa.userid = u.id
                WHERE sa.accountnumber = $1
            `, [accountnumber]);
            
            if (accountDetails.length === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Account not found in savings account table",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }
            accountname = accountDetails[0].fullname;
        } else if (accountnumber.startsWith(personal_account_prefix)) {
            accountType = "Personal";
            const { rows: accountDetails } = await pg.query(`
                SELECT sa.*, CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS fullname
                FROM skyeu."User" sa
                JOIN skyeu."User" u ON sa.id = u.id
                WHERE sa.phone = $1
            `, [accountnumber.slice(personal_account_prefix.length)]);
            
            if (accountDetails.length === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Account not found in savings account table",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }
            accountname = accountDetails[0].fullname;
        } else if (accountnumber.startsWith(loan_account_prefix)) {
            accountType = "Loan";
            const { rows: accountDetails } = await pg.query(`
                SELECT sa.*, CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS fullname
                FROM skyeu."loanaccounts" sa
                JOIN skyeu."User" u ON sa.userid = u.id
                WHERE sa.accountnumber = $1
            `, [accountnumber]);
            
            if (accountDetails.length === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Account not found in savings account table",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }
            accountname = accountDetails[0].fullname;
        } else if (accountnumber.startsWith(rotary_account_prefix)) {
            accountType = "Rotary";
            const { rows: accountDetails } = await pg.query(`
                SELECT ra.*, CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS fullname
                FROM skyeu."rotaryaccount" ra
                JOIN skyeu."User" u ON ra.userid = u.id
                WHERE ra.accountnumber = $1
            `, [accountnumber]);
            
            if (accountDetails.length === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Account not found in rotary account table",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }
            accountname = accountDetails[0].fullname;
        } else {
            accountType = "Personal";
            const { rows: accountDetails } = await pg.query(`
                SELECT *, CONCAT(firstname, ' ', lastname, ' ', COALESCE(othernames, '')) AS fullname
                FROM skyeu."User"
                WHERE phone = $1
            `, [accountnumber]);

            if (accountDetails.length === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Not An Acceptable Account Type",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }
            accountname = accountDetails[0].fullname;
            accountnumber = `${personal_account_prefix}${accountnumber}`;
        } 

        await activityMiddleware(req, user.id, 'Account type retrieved successfully', 'ACCOUNT_TYPE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Account type retrieved successfully",
            statuscode: StatusCodes.OK,
            data: { accounttype: accountType, accountnumber, accountname },
            errors: []
        });
    } catch (error) {
        console.error("Error fetching account type:", error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching account type', 'ACCOUNT_TYPE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal server error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getAccountType };