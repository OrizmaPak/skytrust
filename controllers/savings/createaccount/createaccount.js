const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const manageSavingsAccount = async (req, res) => {
    const user = req.user;
    let { savingsproductid, userid=user.id, amount = 0, branch=user.branch, registrationpoint=user.registrationpoint, registrationcharge=0, registrationdesc='', bankname1, bankaccountname1, bankaccountnumber1, bankname2, bankaccountname2, bankaccountnumber2, accountofficer=0, sms, whatsapp, email, createdby, accountnumber, member=0, registrationdate, reason, status} = req.body;

    try {
        sms = sms ? true : false;
        whatsapp = whatsapp ? true : false;
        email = email ? true : false;
        //   Type validation based on the model
        let typeErrors = [];

        if (savingsproductid&&isNaN(parseInt(savingsproductid))) typeErrors.push('savingsproductid must be a number.');
        if (isNaN(parseInt(userid))) typeErrors.push('userid must be a number.');
        if (isNaN(parseInt(amount))) typeErrors.push('amount must be a number.');
        if (isNaN(parseInt(branch))) typeErrors.push('branch must be a number.');
        if (registrationpoint !== undefined && registrationpoint !== '' && isNaN(parseInt(registrationpoint))) typeErrors.push('registrationpoint must be a number.');
        if (isNaN(parseInt(registrationcharge))) typeErrors.push('registrationcharge must be a number.');
        if (registrationdesc !== undefined && registrationdesc !== '' && typeof registrationdesc !== 'string') typeErrors.push('registrationdesc must be a string.');
        if (bankname1 !== undefined && bankname1 !== '' && typeof bankname1 !== 'string') typeErrors.push('bankname1 must be a string.');
        if (bankaccountname1 !== undefined && bankaccountname1 !== '' && typeof bankaccountname1 !== 'string') typeErrors.push('bankaccountname1 must be a string.');
        if (bankaccountnumber1 !== undefined && bankaccountnumber1 !== '' && typeof bankaccountnumber1 !== 'string') typeErrors.push('bankaccountnumber1 must be a string.');
        if (bankname2 !== undefined && bankname2 !== '' && typeof bankname2 !== 'string') typeErrors.push('bankname2 must be a string.');
        if (bankaccountname2 !== undefined && bankaccountname2 !== '' && typeof bankaccountname2 !== 'string') typeErrors.push('bankaccountname2 must be a string.');
        if (bankaccountnumber2 !== undefined && bankaccountnumber2 !== '' && isNaN(parseInt(bankaccountnumber2))) typeErrors.push('bankaccountnumber2 must be a number.');
        if (accountofficer !== 0 && accountofficer !== undefined && accountofficer !== '' && typeof accountofficer !== 'string') typeErrors.push('accountofficer must be a string.');
        // if (sms !== undefined && sms !== '') {
        //     if (sms.toLowerCase() !== 'true' && sms.toLowerCase() !== 'false') {
        //         typeErrors.push('sms must be a boolean.');
        //     }
        // }
        // if (whatsapp !== undefined && whatsapp !== '') {
        //     if (whatsapp.toLowerCase() !== 'true' && whatsapp.toLowerCase() !== 'false') {
        //         typeErrors.push('whatsapp must be a boolean.');
        //     }
        // }
        // if (email !== undefined && email !== '') {
        //     if (email.toLowerCase() !== 'true' && email.toLowerCase() !== 'false') {
        //         typeErrors.push('email must be a boolean.');
        //     }
        // }
        if (registrationdate !== undefined && registrationdate !== '' && isNaN(Date.parse(registrationdate))) typeErrors.push('registrationdate must be a valid date.');

        if (accountnumber !== undefined && accountnumber !== '' && isNaN(parseInt(accountnumber))) typeErrors.push('accountnumber must be a number.');

        // If any type errors are found, return an error response
        if (typeErrors.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Invalid data types.",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: typeErrors
            });
        }

        // Proceed with the existing code for managing the savings account
        const user = req.user;

        // Check if all required fields are provided
        let missingFields = [];
        if(!accountnumber){
            if (!savingsproductid) missingFields.push('savingsproductid');
            if (!userid) missingFields.push('userid');
            if (!amount) missingFields.push('amount');
            if (!branch) missingFields.push('branch');
            // if (!member) missingFields.push('member');
            // if (!registrationcharge) missingFields.push('registrationcharge');
            // if (!createdby) missingFields.push('createdby');
            }

        if (missingFields.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Missing required fields.",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: [`Missing required fields: ${missingFields.join(', ')}.`]
            });
        }

        // Check if the savings product exists
        const productQuery = `SELECT * FROM sky."savingsproduct" WHERE id = $1 AND status = 'ACTIVE'`;
        const productResult = await pg.query(productQuery, [savingsproductid]);

        if (productResult.rowCount === 0 && !accountnumber) {
            await activityMiddleware(req, createdby, 'Attempt to create a savings account with a non-existent product', 'ACCOUNT');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Savings product does not exist.",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Savings product does not exist."]
            });
        }

        // Check if the account officer exists and is a user
        if (accountofficer) {
            const officerQuery = `SELECT * FROM sky."User" WHERE id = $1 AND status = 'ACTIVE'`;
            const officerResult = await pg.query(officerQuery, [accountofficer]);

            if (officerResult.rowCount === 0) {
                await activityMiddleware(req, createdby, 'Attempt to assign a non-existent user as account officer', 'ACCOUNT');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Account officer does not exist.",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["Account officer does not exist."]
                });
            }
        }

        // Check if the user already has the savings product
    if (!accountnumber) {
        const existingAccountQuery = `SELECT COUNT(*) FROM sky."savings" WHERE userid = $1 AND savingsproductid = $2 AND member = $3 AND status = 'ACTIVE'`;
        const existingAccountResult = await pg.query(existingAccountQuery, [userid, savingsproductid, member]);
        const accountCount = parseInt(existingAccountResult.rows[0].count);

        // Fetch the savings product details to get the useraccount limit
        const userAccountLimit = productResult.rows[0].useraccount;

        if (accountCount >= userAccountLimit) {
            await activityMiddleware(req, createdby, 'Attempt to create a savings account that exceeds the allowed limit', 'ACCOUNT');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "User has reached the limit of accounts for this savings product.",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["User has reached the limit of accounts for this savings product."]
            });
        }
    }

    // Validate eligibility product category
    if (productResult.eligibilityproductcategory === 'SAVINGS') {
        // Fetch savings account number
        const accountNumberQuery = {
            text: `
                    SELECT accountnumber, dateadded 
                    FROM sky."savings" 
                    WHERE userid = $1 AND savingsproductid = $2 AND status = 'ACTIVE'
                    ORDER BY id DESC
            `,
            values: [user.id, productResult.eligibilityproduct]
        };
        const { rows: accountRows } = await pg.query(accountNumberQuery);

        if (accountRows.length === 0) {
            errors.push({
                field: 'eligibilityproduct',
                message: 'User does not have an account in the specified savings product'
            });
        } else {
            let oldestAccount = accountRows[0];
                    for (const account of accountRows) {
                        if (new Date(account.dateadded) < new Date(oldestAccount.dateadded) && account.status === 'ACTIVE') {
                            oldestAccount = account;
                        }
                    }
                    const { accountnumber, dateadded } = oldestAccount;

            // Fetch account balance
            const balanceQuery = {
                text: `
                    SELECT SUM(credit) - SUM(debit) AS balance 
                    FROM sky."transaction" 
                    WHERE accountnumber = $1 AND status = 'ACTIVE'
                `,
                values: [accountnumber]
            };
            const { rows: balanceRows } = await pg.query(balanceQuery);
            const balance = balanceRows[0].balance || 0;

            // Validate account age
            if (productResult.eligibilityaccountage > 0) {
                const accountAgeInDays = Math.floor((Date.now() - new Date(dateadded).getTime()) / (1000 * 60 * 60 * 24));
                console.log(`Account is ${accountAgeInDays} days old.`);
                const accountAgeInMonths = Math.floor(accountAgeInDays / 30);
                if (accountAgeInMonths < productResult.eligibilityaccountage) {
                    const ageDifference = productResult.eligibilityaccountage - accountAgeInMonths;
                    errors.push({
                        field: 'eligibilityaccountage',
                        message: accountAgeInMonths === 0 
                            ? `User account age is ${accountAgeInDays} days, which is less than the required eligibility account age by ${productResult.eligibilityaccountage * 30 - accountAgeInDays} days`
                            : `User account age is ${accountAgeInMonths} months, which is less than the required eligibility account age by ${ageDifference} months`
                    });
                }
            }

            // Validate minimum balance
            if (productResult.eligibilityminbalance > 0 && balance < productResult.eligibilityminbalance) {
                errors.push({
                    field: 'eligibilityminbalance',
                    message: `User account balance is ${balance}, which is less than the required minimum balance of ${productResult.eligibilityminbalance}`
                });
            }

            if(productResult.eligibilitymincredit > 0){
                        // Validate minimum credit
                    const creditQuery = {
                        text: `
                            SELECT SUM(credit) AS totalCredit 
                            FROM sky."transaction" 
                            WHERE accountnumber = $1 AND status = 'ACTIVE'
                        `,
                        values: [accountnumber]
                    };
                    const { rows: creditRows } = await pg.query(creditQuery);
                    const totalCredit = creditRows[0].totalcredit || 0;

                    if (productResult.eligibilitymincredit > 0 && totalCredit < productResult.eligibilitymincredit) {
                        errors.push({
                            field: 'eligibilitymincredit',
                            message: `User account total credit is ${totalCredit}, which is less than the required minimum credit of ${productResult.eligibilitymincredit}`
                        });
                    }
                }

            if(productResult.eligibilitymindebit > 0){
                // Validate minimum debit
                const debitQuery = {
                    text: `
                        SELECT SUM(debit) AS totalDebit 
                        FROM sky."transaction" 
                        WHERE accountnumber = $1 AND status = 'ACTIVE'
                    `,
                    values: [accountnumber]
                };
                const { rows: debitRows } = await pg.query(debitQuery);
                const totalDebit = debitRows[0].totaldebit || 0;

                if (productResult.eligibilitymindebit > 0 && totalDebit < productResult.eligibilitymindebit) {
                    errors.push({
                        field: 'eligibilitymindebit',
                        message: `User account total debit is ${totalDebit}, which is less than the required minimum debit of ${productResult.eligibilitymindebit}`
                    });
                }
            }

        }
    }

    if (productResult.eligibilityproductcategory === 'LOAN') {
        // Fetch loan account details
        const loanAccountQuery = {
            text: `SELECT * FROM sky."loanaccounts" WHERE userid = $1 AND loanproduct = $2 AND status = 'ACTIVE' ORDER BY id DESC`,
            values: [userid, productResult.eligibilityproduct]
        };
        const { rows: loanAccountRows } = await pg.query(loanAccountQuery);

        if (loanAccountRows.length === 0) {
            errors.push({
                field: 'eligibilityproduct',
                message: 'User does not have an account in the specified loan product'
            });
        } else {
            const loanAccount = loanAccountRows[0];
            let totalClosedAmount = 0;
            let closedAccountsCount = 0;

            // Fetch totalClosedAmount and closedAccountsCount if needed
            if (productResult.eligibilitytype === 'PERCENTAGE' || productResult.eligibilityminimumloan > 0 || productResult.eligibilityminimumclosedaccounts > 0) {
                const aggregateQuery = {
                    text: `
                        SELECT 
                            COALESCE(SUM(closeamount), 0) AS totalClosedAmount,
                            COUNT(*) FILTER (WHERE closeamount > 0) AS closedAccountsCount
                        FROM sky."loanaccounts"
                        WHERE userid = $1 AND loanproduct = $2 AND status = 'ACTIVE'
                    `,
                    values: [user.id, productResult.eligibilityproduct]
                };
                const { rows } = await pg.query(aggregateQuery);
                totalClosedAmount = parseFloat(rows[0].totalclosedamount) || 0;
                closedAccountsCount = parseInt(rows[0].closedaccountscount, 10) || 0;
            }

            // // Validate loan amount based on eligibility type
            // if (productResult.eligibilitytype === 'AMOUNT') {
            //     if (loanamount < productResult.minimumloan || loanamount > productResult.maximumloan) {
            //         errors.push({
            //             field: 'loanamount',
            //             message: 'Loan amount must be within the range of minimum and maximum loan amounts'
            //         });
            //     }
            // } else if (productResult.eligibilitytype === 'PERCENTAGE') {
            //     const calculatedMaximumLoan = (totalClosedAmount * productResult.maximumloan) / 100;
            //     if (loanamount < productResult.minimumloan || loanamount > calculatedMaximumLoan) {
            //         errors.push({
            //             field: 'loanamount',
            //             message: 'Loan amount must be within the range of minimum loan and calculated maximum loan based on closed amount'
            //         });
            //     }
            // }

            // Validate eligibility minimum loan
            if (productResult.eligibilityminimumloan > 0 && totalClosedAmount < productResult.eligibilityminimumloan) {
                errors.push({
                    field: 'eligibilityminimumloan',
                    message: 'User total closed loan amount is less than the required eligibility minimum loan amount'
                });
            }

            // Validate eligibility minimum closed accounts
            if (productResult.eligibilityminimumclosedaccounts > 0 && closedAccountsCount < productResult.eligibilityminimumclosedaccounts) {
                errors.push({
                    field: 'eligibilityminimumclosedaccounts',
                    message: 'User closed loan accounts count is less than the required eligibility minimum closed accounts'
                });
            }
        }
    }

        // Fetch the organisation settings
        const orgSettingsQuery = `SELECT * FROM sky."Organisationsettings" WHERE status = 'ACTIVE' LIMIT 1`;
        const orgSettingsResult = await pg.query(orgSettingsQuery);

        if (orgSettingsResult.rowCount === 0) {
            await activityMiddleware(req, createdby, 'Organisation settings not found', 'ACCOUNT');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Organisation settings not found.",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["Organisation settings not found."]
            });
        }

        const orgSettings = orgSettingsResult.rows[0];
        const accountNumberPrefix = orgSettings.savings_account_prefix;

        if (!accountNumberPrefix) {
            await activityMiddleware(req, createdby, 'Account number prefix not found in organisation settings', 'ACCOUNT');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Savings account prefix not set in organisation settings.",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["Savings account prefix not set in organisation settings."]
            });
        }

        const accountRowsQuery = `SELECT accountnumber FROM sky."savings" WHERE accountnumber::text LIKE $1 AND status = 'ACTIVE' ORDER BY accountnumber DESC LIMIT 1`;
        const { rows: accountRows } = await pg.query(accountRowsQuery, [`${accountNumberPrefix}%`]);

        let generatedAccountNumber;
        if (accountRows.length === 0) {
            generatedAccountNumber = `${accountNumberPrefix}${'0'.repeat(10 - accountNumberPrefix.toString().length - 1)}1`;
        } else {
            const highestAccountNumber = accountRows[0].accountnumber;
            const newAccountNumber = parseInt(highestAccountNumber) + 1;
            const newAccountNumberStr = newAccountNumber.toString();

            if (newAccountNumberStr.startsWith(accountNumberPrefix)) {
                generatedAccountNumber = newAccountNumberStr.padStart(10, '0');
            } else {
                await activityMiddleware(req, createdby, `More accounts cannot be opened with the prefix ${accountNumberPrefix}. Please update the prefix to start a new account run.`, 'ACCOUNT');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `More accounts cannot be opened with the prefix ${accountNumberPrefix}. Please update the prefix to start a new account run.`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }

        if (accountnumber) {
            // Check if the account number already exists
            const accountNumberExistsQuery = `SELECT * FROM sky."savings" WHERE accountnumber = $1`;
            const accountNumberExistsResult = await pg.query(accountNumberExistsQuery, [accountnumber]);

            if (accountNumberExistsResult.rowCount === 0) {
                await activityMiddleware(req, createdby, 'Attempt to update a savings account with a non-existent account number', 'ACCOUNT');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Account number does not exist.",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["Account number does not exist."]
                });
            }

            // Check if the branch exists in the branch table if branch is sent
            if (branch) {
                 const branchExistsQuery = `SELECT * FROM sky."Branch" WHERE id = $1 AND status = 'ACTIVE'`;
                const branchExistsResult = await pg.query(branchExistsQuery, [branch]);

                if (branchExistsResult.rowCount === 0) {
                    await activityMiddleware(req, createdby, 'Attempt to update a savings account with a non-existent branch', 'ACCOUNT');
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: "Branch does not exist.",
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: ["Branch does not exist."]
                    });
                }
            }

            // Update existing savings account
            const updateAccountQuery = `
                UPDATE sky."savings"
                SET branch = COALESCE($1, branch), 
                    amount = COALESCE($2, amount), 
                    registrationpoint = COALESCE($3, registrationpoint), 
                    registrationcharge = COALESCE($4, registrationcharge), 
                    registrationdesc = COALESCE($5, registrationdesc), 
                    bankname1 = COALESCE($6, bankname1), 
                    bankaccountname1 = COALESCE($7, bankaccountname1), 
                    bankaccountnumber1 = COALESCE($8, bankaccountnumber1), 
                    bankname2 = COALESCE($9, bankname2), 
                    bankaccountname2 = COALESCE($10, bankaccountname2), 
                    bankaccountnumber2 = COALESCE($11, bankaccountnumber2), 
                    accountofficer = COALESCE($12, accountofficer), 
                    sms = COALESCE($13, sms), 
                    whatsapp = COALESCE($14, whatsapp), 
                    email = COALESCE($15, email), 
                    status = COALESCE($16, status),
                    member = COALESCE($17, member),
                    registrationdate = COALESCE($18, registrationdate),
                    reason = COALESCE($19, reason)
                WHERE accountnumber = $20
                RETURNING id, status
            `;
            const updateAccountResult = await pg.query(updateAccountQuery, [
                branch, amount, registrationpoint, registrationcharge, registrationdesc, bankname1, bankaccountname1, bankaccountnumber1??0, bankname2, bankaccountname2, bankaccountnumber2??0, accountofficer, sms, whatsapp, email, status, member, registrationdate, reason, accountnumber
            ]);

            const updatedAccountId = updateAccountResult.rows[0].id;

            console.log('status', status, updateAccountResult.rows[0].status)

            // Record the activity
            await activityMiddleware(req, createdby, `Savings account updated with ID: ${updatedAccountId}`, 'ACCOUNT');

            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Savings account updated successfully.",
                statuscode: StatusCodes.OK,
                data: { id: updatedAccountId },
                errors: []
            });
        } else {
            // Check if the userid exists in the user table
            const userExistsQuery = `SELECT * FROM sky."User" WHERE id = $1 AND status = 'ACTIVE'`;
            const userExistsResult = await pg.query(userExistsQuery, [userid]);

            if (userExistsResult.rowCount === 0) {
                await activityMiddleware(req, createdby, 'Attempt to create a savings account for a non-existent user', 'ACCOUNT');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "User does not exist.",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["User does not exist."]
                });
            }

            // Check if the branch exists in the branch table
            const branchExistsQuery = `SELECT * FROM sky."Branch" WHERE id = $1 AND status = 'ACTIVE'`;
            const branchExistsResult = await pg.query(branchExistsQuery, [branch]);

            if (branchExistsResult.rowCount === 0) {
                await activityMiddleware(req, createdby, 'Attempt to create a savings account with a non-existent branch', 'ACCOUNT');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Branch does not exist.",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["Branch does not exist."]
                });
            }
            // Save the new savings account
            const insertAccountQuery = `
                INSERT INTO sky."savings" 
                (savingsproductid, accountnumber, userid, amount, branch, registrationpoint, registrationcharge, registrationdate, registrationdesc, bankname1, bankaccountname1, bankaccountnumber1, bankname2, bankaccountname2, bankaccountnumber2, accountofficer, sms, whatsapp, email, status, dateadded, createdby, member)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
                RETURNING id, accountnumber
            `;
            const insertAccountResult = await pg.query(insertAccountQuery, [
                savingsproductid, generatedAccountNumber, userid, amount, branch, registrationpoint, registrationcharge, new Date(), registrationdesc, bankname1, bankaccountname1, bankaccountnumber1 =="" ? 0 :bankaccountnumber1, bankname2, bankaccountname2, bankaccountnumber2 == "" ? 0 : bankaccountnumber2, accountofficer, sms ?? false, whatsapp ?? false, email ?? false, 'ACTIVE', new Date(), userid, member
            ]);

            const newAccountId = insertAccountResult.rows[0].id;
            const newAccountNumber = insertAccountResult.rows[0].accountnumber;

            // Record the activity
            await activityMiddleware(req, createdby, `Savings account created with ID: ${newAccountId}`, 'ACCOUNT');

            return res.status(StatusCodes.CREATED).json({
                status: true,
                message: "Savings account created successfully.",
                statuscode: StatusCodes.CREATED,
                data: { id: newAccountId, accountnumber: newAccountNumber },
                errors: []
            });
        }
    } catch (error) {
        console.error(error);
        await activityMiddleware(req, createdby, 'An unexpected error occurred while creating or updating the savings account', 'ACCOUNT');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,  
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: ["An unexpected error occurred while creating or updating the savings account."]
        });
    }
};

module.exports = {
    manageSavingsAccount
};
