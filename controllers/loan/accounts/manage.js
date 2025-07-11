const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { generateNextDates, validateCode } = require("../../../utils/datecode");
const { generateRepaymentSchedule, calculateInterest, generateRefinedRepaymentSchedule } = require("../../../utils/loancalculator");
const { number } = require("joi");

const manageLoanAccount = async (req, res) => {
    let { id, accountnumber, userid, registrationpoint, registrationcharge=0, registrationdesc, bankname1, bankaccountname1, bankaccountnumber1, bankname2, bankaccountname2, bankaccountnumber2, accountofficer, loanproduct, repaymentfrequency, numberofrepayments, duration, durationcategory, interestmethod, seperateinterest, interestrate, defaultpenaltyid, loanamount, member, status, interestratetype, dateclosed, closeamount } = req.body;
    seperateinterest = seperateinterest ? true : false;
    const user = req.user;
    let generatedAccountNumber;

    // Basic validation
    const errors = [];

    // Validate user ID
    if (!userid) {
        errors.push({
            field: 'userid',
            message: 'User ID not found'
        });
    } else if (isNaN(parseInt(userid))) {
        errors.push({
            field: 'userid',
            message: 'User ID must be a number'
        });
    }

    // Validate registration point
    if (registrationpoint !== undefined && registrationpoint !== '' && isNaN(parseInt(registrationpoint))) {
        errors.push({
            field: 'registrationpoint',
            message: 'Registration point must be a number'
        });
    }

    // Validate registration charge
    if (registrationcharge !== undefined && registrationcharge !== '' && isNaN(parseFloat(registrationcharge))) {
        errors.push({
            field: 'registrationcharge',
            message: 'Registration charge must be a number'
        });
    }

    // Validate registration description
    if (registrationdesc !== undefined && registrationdesc !== '' && typeof registrationdesc !== 'string') {
        errors.push({
            field: 'registrationdesc',
            message: 'Registration description must be a string'
        });
    }

    // Validate bank name 1
    if (bankname1 !== undefined && bankname1 !== '' && typeof bankname1 !== 'string') {
        errors.push({
            field: 'bankname1',
            message: 'Bank name 1 must be a string'
        });
    }

    // Validate bank account name 1
    if (bankaccountname1 !== undefined && bankaccountname1 !== '' && typeof bankaccountname1 !== 'string') {
        errors.push({
            field: 'bankaccountname1',
            message: 'Bank account name 1 must be a string'
        });
    }

    // Validate bank account number 1
    if (bankaccountnumber1 !== undefined && bankaccountnumber1 !== '' && isNaN(parseInt(bankaccountnumber1))) {
        errors.push({
            field: 'bankaccountnumber1',
            message: 'Bank account number 1 must be a number'
        });
    }

    // Validate bank name 2
    if (bankname2 !== undefined && bankname2 !== '' && typeof bankname2 !== 'string') {
        errors.push({
            field: 'bankname2',
            message: 'Bank name 2 must be a string'
        });
    }

    // Validate bank account name 2
    if (bankaccountname2 !== undefined && bankaccountname2 !== '' && typeof bankaccountname2 !== 'string') {
        errors.push({
            field: 'bankaccountname2',
            message: 'Bank account name 2 must be a string'
        });
    }

    // Validate bank account number 2
    if (bankaccountnumber2 !== undefined && bankaccountnumber2 !== '' && isNaN(parseInt(bankaccountnumber2))) {
        errors.push({
            field: 'bankaccountnumber2',
            message: 'Bank account number 2 must be a number'
        });
    }

    // Validate account officer
    if (accountofficer !== undefined && accountofficer !== '' && typeof accountofficer !== 'string') {
        errors.push({
            field: 'accountofficer',
            message: 'Account officer must be a string'
        });
    }

    // Validate loan product
    if (!loanproduct) {
        errors.push({
            field: 'loanproduct',
            message: 'Loan product not found'
        });
    } else if (isNaN(parseInt(loanproduct))) {
        errors.push({
            field: 'loanproduct',
            message: 'Loan product must be a number'
        });
    }

    // Validate repayment frequency
    if (repaymentfrequency !== undefined && repaymentfrequency !== '' && typeof repaymentfrequency !== 'string') {
        errors.push({
            field: 'repaymentfrequency',
            message: 'Repayment frequency must be a string'
        });
    }

    // Validate number of repayments
    if (numberofrepayments !== undefined && numberofrepayments !== '' && isNaN(parseInt(numberofrepayments))) {
        errors.push({
            field: 'numberofrepayments',
            message: 'Number of repayments must be a number'
        });
    }

    // Validate duration
    if (duration !== undefined && duration !== '' && isNaN(parseInt(duration))) {
        errors.push({
            field: 'duration',
            message: 'Duration must be a number'
        });
    }

    // Validate duration category
    if (durationcategory !== undefined && durationcategory !== '' && typeof durationcategory !== 'string') {
        errors.push({
            field: 'durationcategory',
            message: 'Duration category must be a string'
        });
    }

    // Validate interest method
    if (interestmethod !== undefined && interestmethod !== '' && typeof interestmethod !== 'string') {
        errors.push({
            field: 'interestmethod',
            message: 'Interest method must be a string'
        });
    }

    // Validate interest rate
    if (interestrate !== undefined && interestrate !== '' && isNaN(parseFloat(interestrate))) {
        errors.push({
            field: 'interestrate',
            message: 'Interest rate must be a number'
        });
    }

    // Validate interest rate type
    if (interestratetype !== undefined && interestratetype !== '' && !['INSTALLMENT', 'PRINCIPAL'].includes(interestratetype)) {
        errors.push({
            field: 'interestratetype',
            message: 'Interest rate type must be either "INSTALLMENT" or "PRINCIPAL"'
        });
    }

    // Validate default penalty ID
    if (defaultpenaltyid !== undefined && defaultpenaltyid !== '' && isNaN(parseInt(defaultpenaltyid))) {
        errors.push({
            field: 'defaultpenaltyid',
            message: 'Default penalty ID must be a number'
        });
    }

    // Validate loan amount
    if (loanamount === undefined || loanamount === '' || isNaN(parseFloat(loanamount))) {
        errors.push({
            field: 'loanamount',
            message: 'Loan amount must be a number'
        });
    }

    // If there are validation errors, return a bad request response
    if (errors.length > 0) {
        const errorMessages = errors.map(error => error.message).join(', ');
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Validation Errors: ${errorMessages}`,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: errors
        });
    } 

    try {
        // Check if the user exists and get the branch from the user table
        const userQuery = {
            text: 'SELECT * FROM skyeu."User" WHERE id = $1',
            values: [userid]
        };
        const { rows: userRows } = await pg.query(userQuery);
        if (userRows.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'User does not exist',
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        const branch = userRows[0].branch;
        const phone = userRows[0].phone;

        // Check if the loan product exists
        const loanProductQuery = {
            text: 'SELECT * FROM skyeu."loanproduct" WHERE id = $1 AND ($2::text = ANY(string_to_array(membership, \'||\')) OR membership = $2::text)',
            values: [loanproduct, member]
        };
        const { rows: loanProductRows } = await pg.query(loanProductQuery);
        if (loanProductRows.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Loan product does not exist',
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

      
        // Check if the branch exists
        const branchQuery = {
            text: 'SELECT * FROM skyeu."Branch" WHERE id = $1',
            values: [branch]
        };
        const { rows: branchRows } = await pg.query(branchQuery);
        if (branchRows.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Branch does not exist',
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Check if the branch is excluded from the loan product
        const loanProduct = loanProductRows[0];
        if (loanProduct.excludebranch) {
            const excludedBranches = loanProduct.excludebranch.split(',').map(Number);
            if (excludedBranches.includes(branch)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: 'This branch does not have the permission to open a loan account',
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }

        if(!accountnumber){
            // Check if the user already has an account for this loan product
            const userAccountsQuery = {
                text: 'SELECT COUNT(*) FROM skyeu."loanaccounts" WHERE userid = $1 AND loanproduct = $2 AND member = $3 AND (dateclosed IS NULL)',
                values: [userid, loanproduct, member]
            };
            const { rows: userAccountsRows } = await pg.query(userAccountsQuery);
            const userAccountCount = parseInt(userAccountsRows[0].count, 10);
    
            // Check if opening another account will exceed the allowed number of accounts
            if (loanProduct.useraccount && userAccountCount >= loanProduct.useraccount) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: 'Maximum active loan accounts reached. Clear outstanding loan to reapply.',
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }

        // Check if the account officer exists
        if (accountofficer) {
            const officerQuery = {
                text: 'SELECT * FROM skyeu."User" WHERE id = $1',
                values: [accountofficer]
            };
            const { rows: officerRows } = await pg.query(officerQuery);
            if (officerRows.length === 0) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: 'Account officer does not exist',
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }

        // Fetch the organisation settings
        const orgSettingsQuery = `SELECT * FROM skyeu."Organisationsettings" LIMIT 1`;
        const orgSettingsResult = await pg.query(orgSettingsQuery);

        if (orgSettingsResult.rowCount === 0) {
            await activityMiddleware(req, user.id, 'Organisation settings not found', 'LOAN_ACCOUNT');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Organisation settings not found.",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["Organisation settings not found."]
            });
        }

        const orgSettings = orgSettingsResult.rows[0];
        const accountNumberPrefix = orgSettings.loan_account_prefix;

        if (!accountNumberPrefix) {
            await activityMiddleware(req, user.id, 'Account number prefix not found in organisation settings', 'LOAN_ACCOUNT');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Loan account prefix not set in organisation settings.",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["Loan account prefix not set in organisation settings."]
            });
        }

        // Fetch the highest account number with the given prefix
        const accountRowsQuery = `SELECT accountnumber FROM skyeu."loanaccounts" WHERE accountnumber::text LIKE $1 ORDER BY accountnumber DESC LIMIT 1`;
        const { rows: accountRows } = await pg.query(accountRowsQuery, [`${accountNumberPrefix}%`]);

        
        if (accountRows.length === 0) {
            // Generate the first account number with the given prefix
            generatedAccountNumber = `${accountNumberPrefix}${'0'.repeat(10 - accountNumberPrefix.toString().length - 1)}1`;
        } else {
            // Generate the next account number
            const highestAccountNumber = accountRows[0].accountnumber;
            const newAccountNumber = parseInt(highestAccountNumber) + 1;
            const newAccountNumberStr = newAccountNumber.toString();

            if (newAccountNumberStr.startsWith(accountNumberPrefix)) {
                generatedAccountNumber = newAccountNumberStr.padStart(10, '0');
            } else {
                await activityMiddleware(req, user.id, `More accounts cannot be opened with the prefix ${accountNumberPrefix}. Please update the prefix to start a new account run.`, 'LOAN_ACCOUNT');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `More accounts cannot be opened with the prefix ${accountNumberPrefix}. Please update the prefix to start a new account run.`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                }); 
            }
        }

        // If account number is not provided, validate repayment settings
        if (!accountnumber) {
            // Check if repayment settings is ACCOUNT
            if (loanProduct.repaymentsettings === 'ACCOUNT') {
                // Validate account-specific settings
                if (!repaymentfrequency) {
                    errors.push({
                        field: 'repaymentfrequency',
                        message: 'Repayment frequency not found'
                    });
                } else if (!validateCode(repaymentfrequency)) {
                    errors.push({
                        field: 'repaymentfrequency',
                        message: 'Repayment frequency is invalid'
                    });
                }

                if (!numberofrepayments) {
                    errors.push({
                        field: 'numberofrepayments',
                        message: 'Number of repayments not found'
                    });
                } else if (isNaN(parseInt(numberofrepayments, 10)) || parseInt(numberofrepayments, 10) <= 0) {
                    errors.push({
                        field: 'numberofrepayments',
                        message: 'Number of repayments must be a positive number'
                    });
                }

                // if (!duration) {
                //     errors.push({
                //         field: 'duration',
                //         message: 'Duration not found'
                //     });
                // } else if (isNaN(parseInt(duration, 10)) || parseInt(duration, 10) <= 0) {
                //     errors.push({
                //         field: 'duration',
                //         message: 'Duration must be a positive number'
                //     });
                // }

                // if (!durationcategory) {
                //     errors.push({
                //         field: 'durationcategory',
                //         message: 'Duration category not found'
                //     });
                // } else if (typeof durationcategory !== 'string' || !['DAY', 'WEEK', 'MONTH', 'YEAR'].includes(durationcategory)) {
                //     errors.push({
                //         field: 'durationcategory',
                //         message: 'Duration category must be one of "DAY", "WEEK", "MONTH", or "YEAR"'
                //     });
                // }

                if (!interestmethod) {
                    errors.push({
                        field: 'interestmethod',
                        message: 'Interest method not found'
                    });
                } else if (typeof interestmethod !== 'string' || !['NO INTEREST', 'FLAT RATE', 'ONE OF INTEREST', 'INTEREST ONLY', 'EQUAL INSTALLMENTS', 'REDUCING BALANCE', 'BALLOON LOAN', 'FIXED RATE', 'UNSECURE LOAN', 'INSTALLMENT LOAN', 'PAYDAY LOAN', 'MICRO LOAN', 'BRIDGE LOAN', 'AGRICULTURAL LOAN', 'EDUCATION LOAN', 'WORKIN CAPITAL'].includes(interestmethod)) {
                    errors.push({
                        field: 'interestmethod',
                        message: 'Interest method must be one of "NO INTEREST", "FLAT RATE", "ONE OF INTEREST", "INTEREST ONLY", "EQUAL INSTALLMENTS", "REDUCING BALANCE", "BALLOON LOAN", "FIXED RATE", "UNSECURE LOAN", "INSTALLMENT LOAN", "PAYDAY LOAN", "MICRO LOAN", "BRIDGE LOAN", "AGRICULTURAL LOAN", "EDUCATION LOAN", or "WORKIN CAPITAL"'
                    });
                }

                if (!interestrate) {
                    errors.push({
                        field: 'interestrate',
                        message: 'Interest rate not found'
                    });
                } else if (isNaN(parseFloat(interestrate)) || parseFloat(interestrate) <= 0) {
                    errors.push({
                        field: 'interestrate',
                        message: 'Interest rate must be a positive number'
                    });
                }
            } else if (loanProduct.repaymentsettings === 'PRODUCT') {
                // Ensure loan product has values for product-specific settings
                if (!loanProduct.repaymentfrequency) {
                    errors.push({
                        field: 'repaymentfrequency',
                        message: 'Repayment frequency not set in loan product'
                    });
                }

                if (!loanProduct.numberofrepayments) {
                    errors.push({
                        field: 'numberofrepayments',
                        message: 'Number of repayments not set in loan product'
                    });
                }

                // if (!loanProduct.duration) {
                //     errors.push({
                //         field: 'duration',
                //         message: 'Duration not set in loan product'
                //     });
                // }

                // if (!loanProduct.durationcategory) {
                //     errors.push({
                //         field: 'durationcategory',
                //         message: 'Duration category not set in loan product'
                //     });
                // }

                if (!loanProduct.interestmethod) {
                    errors.push({
                        field: 'interestmethod',
                        message: 'Interest method not set in loan product'
                    });
                }

                if (!loanProduct.interestrate) {
                    errors.push({
                        field: 'interestrate',
                        message: 'Interest rate not set in loan product'
                    });
                }
            }

            // Validate eligibility product category
            if (loanProduct.eligibilityproductcategory === 'SAVINGS') {
                // Fetch savings account number
                const accountNumberQuery = {
                    text: `
                        SELECT accountnumber, dateadded 
                        FROM skyeu."savings" 
                        WHERE userid = $1 AND savingsproductid = $2 AND member = $3
                    `,
                    values: [userid, loanProduct.eligibilityproduct, member]
                };
                const { rows: accountRows } = await pg.query(accountNumberQuery);

                if (accountRows.length === 0) {
                    errors.push({
                        field: 'eligibilityproduct',
                        message: 'User does not have an account in the eligibility savings product'
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
                            FROM skyeu."transaction" 
                            WHERE accountnumber = $1
                        `,
                        values: [accountnumber]
                    };
                    const { rows: balanceRows } = await pg.query(balanceQuery);
                    const balance = balanceRows[0].balance || 0;

                    // Validate account age
                    if (loanProduct.eligibilityaccountage > 0) {
                        const accountAgeInDays = Math.floor((Date.now() - new Date(dateadded).getTime()) / (1000 * 60 * 60 * 24));
                        console.log(`Account is ${accountAgeInDays} days old.`);
                        const accountAgeInMonths = Math.floor(accountAgeInDays / 30);
                        if (accountAgeInMonths < loanProduct.eligibilityaccountage) {
                            const ageDifference = loanProduct.eligibilityaccountage - accountAgeInMonths;
                            errors.push({
                                field: 'eligibilityaccountage',
                                message: accountAgeInMonths === 0 
                                    ? `User account age is ${accountAgeInDays} days, which is less than the required eligibility account age by ${loanProduct.eligibilityaccountage * 30 - accountAgeInDays} days`
                                    : `User account age is ${accountAgeInMonths} months, which is less than the required eligibility account age by ${ageDifference} months`
                            });
                        }
                    }

                    // Validate minimum balance
                    if (loanProduct.eligibilityminbalance > 0 && balance < loanProduct.eligibilityminbalance) {
                        errors.push({
                            field: 'eligibilityminbalance',
                            message: `Based on the required eligibility product, the user account balance is ${balance}, which is less than the required minimum balance of ${loanProduct.eligibilityminbalance}`
                        });
                    }

                    if (loanProduct.eligibilitymincredit > 0) {
                        // Validate minimum credit
                        const creditQuery = {
                            text: `
                                SELECT SUM(credit) AS totalCredit 
                                FROM skyeu."transaction" 
                                WHERE accountnumber = $1
                            `,
                            values: [accountnumber]
                        };
                        const { rows: creditRows } = await pg.query(creditQuery);
                        const totalCredit = creditRows[0].totalcredit || 0;

                        if (totalCredit < loanProduct.eligibilitymincredit) {
                            errors.push({
                                field: 'eligibilitymincredit',
                                message: `User account total credit is ${totalCredit}, which is less than the required minimum credit of ${loanProduct.eligibilitymincredit}`
                            });
                        }
                    }

                    if (loanProduct.eligibilitymindebit > 0) {
                        // Validate minimum debit
                        const debitQuery = {
                            text: `
                                SELECT SUM(debit) AS totalDebit 
                                FROM skyeu."transaction" 
                                WHERE accountnumber = $1
                            `,
                            values: [accountnumber]
                        };
                        const { rows: debitRows } = await pg.query(debitQuery);
                        const totalDebit = debitRows[0].totaldebit || 0;

                        if (totalDebit < loanProduct.eligibilitymindebit) {
                            errors.push({
                                field: 'eligibilitymindebit',
                                message: `User account total debit is ${totalDebit}, which is less than the required minimum debit of ${loanProduct.eligibilitymindebit}`
                            });
                        }
                    }

                    const { eligibilitytype, minimumloan, maximumloan } = loanProduct;

                    // Validate loan amount based on eligibility type
                    if (eligibilitytype === 'AMOUNT') {
                        if (loanamount < minimumloan || loanamount > maximumloan) {
                            const amountDifference = loanamount < minimumloan ? minimumloan - loanamount : loanamount - maximumloan;
                            const direction = loanamount < minimumloan ? 'below' : 'above';
                            errors.push({
                                field: 'loanamount',
                                message: `Loan amount is ${amountDifference} ${direction} the allowed range of minimum and maximum loan amounts`
                            });
                        }
                    } else if (eligibilitytype === 'PERCENTAGE') {
                        const calculatedMaximumLoan = (balance * maximumloan) / 100;
                        if (loanamount < minimumloan || loanamount > calculatedMaximumLoan) {
                            const amountDifference = loanamount < minimumloan ? minimumloan - loanamount : loanamount - calculatedMaximumLoan;
                            const direction = loanamount < minimumloan ? 'below' : 'above';
                            errors.push({
                                field: 'loanamount',
                                message: `Loan amount is ${amountDifference} ${direction} the allowed range of minimum loan and calculated maximum loan based on account balance`
                            });
                        }
                    }
                }
            }

            if (loanProduct.eligibilityproductcategory == 'LOAN') {
                // Fetch loan account details
                const loanAccountQuery = {
                    text: 'SELECT * FROM skyeu."loanaccounts" WHERE userid = $1 AND loanproduct = $2 AND member = $3',
                    values: [userid, loanProduct.eligibilityproduct, member]
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
                    if (loanProduct.eligibilitytype === 'PERCENTAGE' || loanProduct.eligibilityminimumloan > 0 || loanProduct.eligibilityminimumclosedaccounts > 0) {
                        const aggregateQuery = {
                            text: `
                                SELECT 
                                    COALESCE(SUM(closeamount), 0) AS totalClosedAmount,
                                    COUNT(*) FILTER (WHERE closeamount > 0) AS closedAccountsCount
                                FROM skyeu."loanaccounts"
                                WHERE userid = $1 AND loanproduct = $2
                            `,
                            values: [userid, loanProduct.eligibilityproduct]
                        };
                        const { rows } = await pg.query(aggregateQuery);
                        totalClosedAmount = parseFloat(rows[0].totalclosedamount) || 0;
                        closedAccountsCount = parseInt(rows[0].closedaccountscount, 10) || 0;
                    }
    
                    // Validate loan amount based on eligibility type
                    if (loanProduct.eligibilitytype === 'AMOUNT') {
                        if (loanamount < loanProduct.minimumloan || loanamount > loanProduct.maximumloan) {
                            errors.push({
                                field: 'loanamount',
                                message: 'Loan amount must be within the range of minimum and maximum loan amounts'
                            });
                        }
                    } else if (loanProduct.eligibilitytype === 'PERCENTAGE') {
                        const calculatedMaximumLoan = (totalClosedAmount * loanProduct.maximumloan) / 100;
                        if (loanamount < loanProduct.minimumloan || loanamount > calculatedMaximumLoan) {
                            errors.push({
                                field: 'loanamount',
                                message: 'Loan amount must be within the range of minimum loan and calculated maximum loan based on closed amount'
                            });
                        }
                    }
    
                    // Validate eligibility minimum loan
                    if (loanProduct.eligibilityminimumloan > 0 && totalClosedAmount < loanProduct.eligibilityminimumloan) {
                        errors.push({
                            field: 'eligibilityminimumloan',
                            message: 'User total closed loan amount is less than the required eligibility minimum loan amount'
                        });
                    }
    
                    // Validate eligibility minimum closed accounts
                    if (loanProduct.eligibilityminimumclosedaccounts > 0 && closedAccountsCount < loanProduct.eligibilityminimumclosedaccounts) {
                        errors.push({
                            field: 'eligibilityminimumclosedaccounts',
                            message: 'User closed loan accounts count is less than the required eligibility minimum closed accounts'
                        });
                    }
                }
            }

            // If there are validation errors, return a bad request response
            if (errors.length > 0) {
                const errorMessages = errors.map(error => error.message).join(', ');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Validation Errors: ${errorMessages}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: errors
                });
            }
        }

        // let updatedaccountnumber = accountnumber

        // THIS IS WHERE THE REPAYMENT SCHEDULE IS CREATED
        // IF THE REPAYMENT SETTINGS ARE ACCOUNT, WE NEED TO CREATE A REPAYMENT SCHEDULE
        if(accountnumber)generatedAccountNumber = accountnumber;
        if(accountnumber){
            const deleteScheduleQuery = {
                text: `DELETE FROM skyeu."loanpaymentschedule" WHERE accountnumber = $1`,
                values: [accountnumber]
            };
            await pg.query(deleteScheduleQuery);
        }
        if (loanProduct.repaymentsettings === 'ACCOUNT') {
            // Validate repayment frequency
            if (!validateCode(repaymentfrequency)) {
                errors.push({
                    field: 'repaymentfrequency',
                    message: 'Invalid repayment frequency'
                });
            }

            // Generate repayment dates
            const repaymentDates = generateNextDates(repaymentfrequency, numberofrepayments);

            // return console.log('repaymentDates:', repaymentDates, 'repaymentfrequency:', repaymentfrequency, 'numberofrepayments:', numberofrepayments);

            // Calculate interest based on interest method
            let interest = 0;
            // try {
            //     interest = calculateInterest(loanamount, interestrate, numberofrepayments, interestmethod.replace(' ', '_'));
            //     console.log('Interest ran:', interest);
            //     // if (loanProduct.interestmethod === 'INTEREST ONLY') {
            //     //     numberofrepayments = 1;
            //     // }
            // } catch (error) {
            //     errors.push({
            //         field: 'interestmethod',
            //         message: error.message
            //     });
            // }

            // If there are validation errors, return a bad request response
            if (errors.length > 0) {
                const errorMessages = errors.map(error => error.message).join(', ');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Validation Errors: ${errorMessages}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: errors
                });
            }

            console.log('seperateInterest before:', seperateinterest);

            // Calculate repayment amounts
            const repaymentSchedule = generateRefinedRepaymentSchedule(
                loanamount,
                interestrate,
                numberofrepayments,
                interestmethod.replace(' ', '_'),
                new Date(),
                seperateinterest,
                interestratetype,
                repaymentDates,
                res
            ).map((schedule, index) => ({
                accountnumber: generatedAccountNumber,
                scheduledpaymentdate: repaymentDates[index],
                scheduleamount: parseFloat(schedule.principalAmount.toFixed(2)),
                interestamount: parseFloat(schedule.interestAmount.toFixed(2)),
                status: 'PENDING',
                createdby: user.id,
                dateadded: new Date()
            }));

            // Insert repayment schedule into the database
            for (const schedule of repaymentSchedule) {
                const insertScheduleQuery = {
                    text: `INSERT INTO skyeu."loanpaymentschedule" (accountnumber, scheduledpaymentdate, scheduleamount, interestamount, status, createdby, dateadded) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    values: [schedule.accountnumber, schedule.scheduledpaymentdate, schedule.scheduleamount, schedule.interestamount, schedule.status, schedule.createdby, schedule.dateadded]
                };
                await pg.query(insertScheduleQuery);
            }
        } else if (loanProduct.repaymentsettings === 'PRODUCT') {
            // Use loan product data for repayment frequency and interest method
            const productRepaymentFrequency = loanProduct.repaymentfrequency;
            const productInterestMethod = loanProduct.interestmethod.replace(' ', '_');
            const productLoanAmount = loanamount;
            const productInterestRate = loanProduct.interestrate;
            const productNumberOfRepayments = loanProduct.numberofrepayments;
            numberOfRepayments = productNumberOfRepayments;

            // Validate repayment frequency from loan product
            if (!validateCode(productRepaymentFrequency)) {
                errors.push({
                    field: 'repaymentfrequency',
                    message: 'Invalid repayment frequency from loan product'
                });
            }

            // Generate repayment dates using loan product's repayment frequency
            const repaymentDates = generateNextDates(productRepaymentFrequency, productNumberOfRepayments);

            // Calculate interest based on loan product's interest method
            let interest = 0;
            // try {
            //     interest = calculateInterest(productLoanAmount, productInterestRate, productNumberOfRepayments, productInterestMethod);
            // } catch (error) {
            //     errors.push({
            //         field: 'interestmethod',
            //         message: error.message
            //     });
            // }

            // If there are validation errors, return a bad request response
            if (errors.length > 0) {
                const errorMessages = errors.map(error => error.message).join(', ');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Validation Errors: ${errorMessages}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: errors
                });
            }

            console.log('seperateInterest before:', loanProduct.seperateinterest);

            // Calculate repayment amounts using loan product data
            const repaymentSchedule = generateRefinedRepaymentSchedule(
                productLoanAmount,
                productInterestRate,
                productNumberOfRepayments,
                productInterestMethod,
                new Date(),
                loanProduct.seperateinterest,
                loanProduct.interestratetype,
                repaymentDates,
                res
            ).map((schedule, index) => ({
                accountnumber: generatedAccountNumber,
                scheduledpaymentdate: repaymentDates[index],
                scheduleamount: parseFloat(schedule.principalAmount.toFixed(2)),
                interestamount: parseFloat(schedule.interestAmount.toFixed(2)),
                status: 'PENDING',
                createdby: user.id,
                dateadded: new Date()
            }));

            // Insert repayment schedule into the database
            for (const schedule of repaymentSchedule) {
                const insertScheduleQuery = {
                    text: `INSERT INTO skyeu."loanpaymentschedule" (accountnumber, scheduledpaymentdate, scheduleamount, interestamount, status, createdby, dateadded) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    values: [schedule.accountnumber, schedule.scheduledpaymentdate, schedule.scheduleamount, schedule.interestamount, schedule.status, schedule.createdby, schedule.dateadded]
                };
                await pg.query(insertScheduleQuery);
            }
        }

        // If account number is provided, update the existing loan account
        let loandata
        if (accountnumber) {
            // Check if the account number already exists
            const accountNumberExistsQuery = `SELECT * FROM skyeu."loanaccounts" WHERE accountnumber = $1`;
            const accountNumberExistsResult = await pg.query(accountNumberExistsQuery, [accountnumber]);

            if (accountNumberExistsResult.rowCount === 0) {
                await activityMiddleware(req, user.id, 'Attempt to update a loan account with a non-existent account number', 'LOAN_ACCOUNT');
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
                const branchExistsQuery = `SELECT * FROM skyeu."Branch" WHERE id = $1`;
                const branchExistsResult = await pg.query(branchExistsQuery, [branch]);

                if (branchExistsResult.rowCount === 0) {
                    await activityMiddleware(req, user.id, 'Attempt to update a loan account with a non-existent branch', 'LOAN_ACCOUNT');
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: "Branch does not exist.",
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: ["Branch does not exist."]
                    });
                }
            }
 

            // Update existing loan account
            const updateaccountnumberQuery = {
                text: `UPDATE skyeu."loanaccounts" SET 
                        accountnumber = COALESCE($1, accountnumber), 
                        userid = COALESCE($2, userid),
                        branch = COALESCE($3, branch), 
                        registrationpoint = COALESCE($4, registrationpoint), 
                        registrationcharge = COALESCE($5, registrationcharge), 
                        registrationdesc = COALESCE($6, registrationdesc), 
                        bankname1 = COALESCE($7, bankname1), 
                        bankaccountname1 = COALESCE($8, bankaccountname1), 
                        bankaccountnumber1 = COALESCE($9, bankaccountnumber1), 
                        bankname2 = COALESCE($10, bankname2), 
                        bankaccountname2 = COALESCE($11, bankaccountname2), 
                        bankaccountnumber2 = COALESCE($12, bankaccountnumber2), 
                        accountofficer = COALESCE($13, accountofficer), 
                        loanproduct = COALESCE($14, loanproduct), 
                        repaymentfrequency = COALESCE($15, repaymentfrequency), 
                        numberofrepayments = COALESCE($16, numberofrepayments), 
                        duration = COALESCE($17, duration), 
                        durationcategory = COALESCE($18, durationcategory), 
                        interestmethod = COALESCE($19, interestmethod), 
                        interestrate = COALESCE($20, interestrate), 
                        defaultpenaltyid = COALESCE($21, defaultpenaltyid),
                        loanamount = COALESCE($22, loanamount),
                        status = COALESCE($23, status),
                        dateadded = COALESCE($24, dateadded),
                        createdby = COALESCE($25, createdby),
                        dateclosed = COALESCE($26, dateclosed),
                        closeamount = COALESCE($27, closeamount),
                        seperateinterest = COALESCE($28, seperateinterest),
                        member = COALESCE($29, member),
                        interestratetype = COALESCE($30, interestratetype)
                       WHERE id = $31 RETURNING *`,
                values: [accountnumber, userid, branch, registrationpoint, registrationcharge, registrationdesc, bankname1, bankaccountname1, bankaccountnumber1, bankname2, bankaccountname2, bankaccountnumber2, accountofficer, loanproduct, repaymentfrequency, numberofrepayments, duration, durationcategory, interestmethod, interestrate, defaultpenaltyid, loanamount, status, new Date(), user.id, dateclosed, closeamount, seperateinterest, member, interestratetype, id]
            };
            const { rows: updatedaccountnumberRows } = await pg.query(updateaccountnumberQuery);
            loandata = updatedaccountnumberRows[0];
            console.log('loandata:', loandata);
        } else {
            // Create new loan account
            const createaccountnumberQuery = {
                text: `INSERT INTO skyeu."loanaccounts" 
                        (accountnumber, userid, branch, registrationpoint, registrationcharge, registrationdate, registrationdesc, bankname1, bankaccountname1, bankaccountnumber1, bankname2, bankaccountname2, bankaccountnumber2, accountofficer, loanproduct, repaymentfrequency, numberofrepayments, duration, durationcategory, interestmethod, interestrate, defaultpenaltyid, loanamount, status, dateadded, createdby, dateclosed, closeamount, seperateinterest, member, interestratetype) 
                   VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30) RETURNING *`,
                values: [generatedAccountNumber, userid, branch, registrationpoint, registrationcharge, registrationdesc, bankname1, bankaccountname1, bankaccountnumber1, bankname2, bankaccountname2, bankaccountnumber2, accountofficer, loanproduct, repaymentfrequency, numberofrepayments =="" ? 0 : numberofrepayments, duration, durationcategory, interestmethod, interestrate == "" ? 0 : interestrate, defaultpenaltyid == "" ? null : defaultpenaltyid, loanamount == "" ? 0 : loanamount, 'PENDING APPROVAL', new Date(), user.id, null, null, seperateinterest, member, interestratetype]
            };
            const { rows: newaccountnumberRows } = await pg.query(createaccountnumberQuery);
            loandata = newaccountnumberRows[0];
        }

        // Log activity and return success response
        await activityMiddleware(req, user.id, id ? 'Loan account updated successfully' : 'Loan account created successfully', 'LOAN_ACCOUNT');

        const installmentsQuery = {
            text: `SELECT * FROM skyeu."loanpaymentschedule" WHERE accountnumber = $1`,
            values: [loandata.accountnumber]
        };
        const { rows: installments } = await pg.query(installmentsQuery);

        return res.status(StatusCodes.OK).json({
            status: true,
            message: id ? "Loan account updated successfully" : "Loan account created successfully",
            statuscode: StatusCodes.OK,
            data: {loandata, installments},
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred while managing the loan account', 'LOAN_ACCOUNT');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { manageLoanAccount };
