const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getfullAccountType = async (req, res) => {
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
            SELECT savings_account_prefix, personal_account_prefix, loan_account_prefix, property_account_prefix, rotary_account_prefix, *
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

        const { savings_account_prefix, personal_account_prefix, loan_account_prefix, property_account_prefix, rotary_account_prefix } = settings[0];
        let accountType = null;
        let accountname;
        let status;
        let person = {};

        const calculateAge = (dob) => {
            const diff = Date.now() - new Date(dob).getTime();
            const ageDate = new Date(diff);
            return Math.abs(ageDate.getUTCFullYear() - 1970);
        };

        const getBranchName = async (branchId) => {
            const { rows: branchDetails } = await pg.query(`
                SELECT branch FROM skyeu."Branch" WHERE id = $1
            `, [branchId]);
            return branchDetails.length > 0 ? branchDetails[0].branch : null;
        };

        if(accountnumber){
            const { rows: accountDetails } = await pg.query(`
                SELECT ga.*
                FROM skyeu."Accounts" ga
                WHERE ga.accountnumber = $1
                `, [accountnumber]);
                
                if (accountDetails.length != 0) {
                            accountType = accountDetails[0].accounttype;
                            accountname = accountDetails[0].groupname;
                            status = accountDetails[0].status;
                            person = { 
                                ...accountDetails[0],
                                age: calculateAge(accountDetails[0].dateadded),
                                branchname: await getBranchName(1),
                                phone: settings[0].phone,
                                image: settings[0].logo,
                                gender: 'Business',
                            role: 'SYS ADMIN',
                            dateadded: accountDetails[0].dateadded,
                        };
                        if(accountType){
                            return res.status(StatusCodes.OK).json({
                                status: true,
                                message: "Account type retrieved successfully",
                                statuscode: StatusCodes.OK,
                                data: { accounttype: accountType, accountnumber, accountname, status, person },
                                errors: []
                            });
                        }
                }
            };
        if (accountnumber.startsWith(savings_account_prefix)) {
            accountType = "Savings";
            const { rows: accountDetails } = await pg.query(`
                SELECT sa.*, u.*, CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS fullname
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
            status = accountDetails[0].status;
            person = { 
                ...accountDetails[0],
                age: calculateAge(accountDetails[0].dateofbirth),
                branchname: await getBranchName(accountDetails[0].branch)
            };
        } else if (accountnumber.startsWith(personal_account_prefix)) {
            accountType = "Personal";
            const { rows: accountDetails } = await pg.query(`
                SELECT sa.*, u.*, CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS fullname
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
            status = accountDetails[0].status;
            person = { 
                ...accountDetails[0],
                age: calculateAge(accountDetails[0].dateofbirth),
                branchname: await getBranchName(accountDetails[0].branch)
            };
        } else if (accountnumber.startsWith(loan_account_prefix)) {
            accountType = "Loan";
            const { rows: accountDetails } = await pg.query(`
                SELECT sa.*, u.*, CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS fullname
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
            status = accountDetails[0].status;
            person = { 
                ...accountDetails[0],
                age: calculateAge(accountDetails[0].dateofbirth),
                branchname: await getBranchName(accountDetails[0].branch)
            };
        } else if (accountnumber.startsWith(property_account_prefix)) {
            console.log('we entered the property account')  
            accountType = "Property";
            const { rows: accountDetails } = await pg.query(`
                SELECT sa.*, u.*, CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS fullname
                FROM skyeu."propertyaccount" sa
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
            status = accountDetails[0].status;
            person = { 
                ...accountDetails[0],
                age: calculateAge(accountDetails[0].dateofbirth),
                branchname: await getBranchName(accountDetails[0].branch)
            };
        } else if (accountnumber.startsWith(rotary_account_prefix)) {
            accountType = "Rotary";
            const { rows: accountDetails } = await pg.query(`
                SELECT sa.*, u.*, CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS fullname
                FROM skyeu."rotaryaccount" sa
                JOIN skyeu."User" u ON sa.userid = u.id
                WHERE sa.accountnumber = $1
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
            status = accountDetails[0].status;
            person = { 
                ...accountDetails[0],
                age: calculateAge(accountDetails[0].dateofbirth),
                branchname: await getBranchName(accountDetails[0].branch)
            };
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
            status = accountDetails[0].status;
            person = { 
                ...accountDetails[0],
                age: calculateAge(accountDetails[0].dateofbirth),
                branchname: await getBranchName(accountDetails[0].branch)
            };
        } 

        await activityMiddleware(req, user.id, 'Account type retrieved successfully', 'ACCOUNT_TYPE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Account type retrieved successfully",
            statuscode: StatusCodes.OK,
            data: { accounttype: accountType, accountnumber, accountname, status, person },
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

module.exports = { getfullAccountType };
