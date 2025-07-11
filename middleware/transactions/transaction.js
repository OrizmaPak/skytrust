const pg = require('../../db/pg'); // Use your existing pg setup
const { StatusCodes } = require('http-status-codes'); // Assuming you are using http-status-codes for status codes
const { activityMiddleware } = require('../activity'); // Import activity middleware
const { 
    saveFailedTransaction, 
    savePendingTransaction, 
    saveTransaction, 
    calculateCharge, 
    calculatePenalty, 
    calculateTax, 
    generateNewReference, 
    sendNotification, 
    handleCreditRedirectToPersonnalAccount, 
    applyMinimumCreditAmountPenalty
} = require('../../utils/transactionHelper'); // Import all helper functions
const { getTransactionPeriod, generateNextDates } = require('../../utils/datecode');
const { savingsCredit } = require('./savings/credit');
const { savingsDebit } = require('./savings/debit');
const { personalCredit } = require('./personal/credit');
const { personalDebit } = require('./personal/debit');
const { loanCredit } = require('./loan/credit');
const { loanDebit } = require('./loan/debit');
const { glAccountCredit } = require('./gl/credit');
const { glAccountDebit } = require('./gl/debit');
const { propertyAccountCredit } = require('./property/credit');
const { rotaryCredit } = require('./rotary/credit');
const { rotaryDebit } = require('./rotary/debit');

// Middleware function to save a transaction
const saveTransactionMiddleware = async (req, res, next) => {
    if(!req.user){
        req.user = {
            id: 0,
            firstname: 'system',
            lastname: 'automation',
            othernames: '',
            image: '',        
            email: 'divinehelpfarmers@gmail.com',
            phone: '08132186025',
            country: '',
            state: '',
            emailverified: null,
            address: '',
            role: 'SUPERADMIN',
            permissions: null,
            userpermissions: '',
            officeaddress: null,
            image2: null,
            gender: null,
            occupation: null,
            lga: null,
            town: null,
            maritalstatus: null,
            spousename: null,
            stateofresidence: null,
            lgaofresidence: null,
            nextofkinfullname: null,
            nextofkinphone: null,
            nextofkinrelationship: null,
            nextofkinaddress: null,
            nextofkinofficeaddress: null,
            nextofkinoccupation: null,
            dateofbirth: '1996-02-28T23:00:00.000Z',
            branch: 0,
            registrationpoint: 0,
            dateadded: '2025-01-02T14:53:29.478Z',
            lastupdated: '2025-01-08T23:39:43.559Z',
            status: 'ACTIVE',
            createdby: 0
          }
        }
        console.log('entering saveTransactionMiddleware', req.user)
        console.log('entering saveTransactionMiddleware', req.body)
        let user = req.user; // Get the user from the request
    const client = pg; // Use the pg client for database operations
    console.log('wanting to enter the try block')
    try {
        console.log('entered the try block')
        await client.query('BEGIN'); // Start a transaction
        await activityMiddleware(req, req.user.id, 'Transaction started', 'TRANSACTION'); // Log the start of a transaction

        // Extract transaction details from the request body
        const {
            accountnumber,
            credit,
            debit,
            reference,
            transactiondate = new Date(),
            transactiondesc = '',
            currency,
            description = '',
            branch = '',
            registrationpoint = '',
            ttype,
            tfrom,
            tax = false,
        } = req.body;

        let whichaccount; // Variable to determine the type of account
        let accountuser; // Variable to store account user details
        let personnalaccount; // Variable to store personal account number

        // Log activity for attempting to save transaction
        await activityMiddleware(req, req.user.id, 'Attempting to save transaction', 'TRANSACTION');
        
        // Query to get organisation settings
        const orgSettingsQuery = `SELECT * FROM skyeu."Organisationsettings" LIMIT 1`;
        const orgSettingsResult = await client.query(orgSettingsQuery);
        if (orgSettingsResult.rowCount === 0) {
            // If organisation settings are not found, rollback the transaction
            await activityMiddleware(req, req.user.id, 'Organisation settings not found', 'TRANSACTION');
            await client.query('ROLLBACK'); // Rollback the transaction
            await activityMiddleware(req, req.user.id, 'Transaction rolled back due to missing organisation settings', 'TRANSACTION');
            req.transactionError = {
                status: StatusCodes.INTERNAL_SERVER_ERROR,
                message: 'Organisation settings not found.',
                errors: ['Internal server error.'] 
            };
            req.body.transactiondesc += 'Organisation settings not found.|';
            return next();
        }
        const orgSettings = orgSettingsResult.rows[0]; // Store organisation settings
        req['orgSettings'] = orgSettings; // Attach organisation settings to request

        // Check if both credit and debit are greater than zero
        if (credit > 0 && debit > 0) {
            // If both are greater than zero, save the transaction as failed
            await saveFailedTransaction(client, req, res, 'Invalid transaction', await generateNewReference(client, accountnumber, req, res), whichaccount);
            await client.query('COMMIT'); // Commit the transaction
            await activityMiddleware(req, req.user.id, 'Transaction committed after invalid credit and debit', 'TRANSACTION');
            req.transactionError = {
                status: StatusCodes.EXPECTATION_FAILED,
                message: 'Both credit and debit cannot be greater than zero.',
                errors: ['Invalid transaction.']
            };
            req.body.transactiondesc += 'Both credit and debit cannot be greater than zero.|';
            return next();
        }

         // Validate the account number and status based on organisation settings prefixes
        //  const { savings_account_prefix, loan_account_prefix, rotary_account_prefix, property_account_prefix } = orgSettings;

        //  let whichaccount;
        //  let accountResult;
 
        //  if (savings_account_prefix && accountnumber.startsWith(savings_account_prefix)) {
        //      whichaccount = 'SAVINGS';
        //      const savingsAccountQuery = `SELECT * FROM skyeu."savings" WHERE accountnumber = $1`;
        //      accountResult = await client.query(savingsAccountQuery, [accountnumber]);
        //  } else if (loan_account_prefix && accountnumber.startsWith(loan_account_prefix)) {
        //      whichaccount = 'LOAN';
        //      const loanAccountQuery = `SELECT * FROM skyeu."loanaccounts" WHERE accountnumber = $1`;
        //      accountResult = await client.query(loanAccountQuery, [accountnumber]);
        //  } else if (rotary_account_prefix && accountnumber.startsWith(rotary_account_prefix)) {
        //      whichaccount = 'ROTARY';
        //      const rotaryAccountQuery = `SELECT * FROM skyeu."rotaryaccount" WHERE accountnumber = $1`;
        //      accountResult = await client.query(rotaryAccountQuery, [accountnumber]);
        //  } else if (property_account_prefix && accountnumber.startsWith(property_account_prefix)) {
        //      whichaccount = 'PROPERTY';
        //      const propertyAccountQuery = `SELECT * FROM skyeu."propertyaccount" WHERE accountnumber = $1`;
        //      accountResult = await client.query(propertyAccountQuery, [accountnumber]);
        //  } else {
        //      // Default to GLACCOUNT if no prefix matches
        //      whichaccount = 'GLACCOUNT';
        //      const glAccountQuery = `SELECT * FROM skyeu."Accounts" WHERE accountnumber = $1`;
        //      accountResult = await client.query(glAccountQuery, [accountnumber]);
        //  }

        // Validate the account number and status
        const savingsAccountQuery = `SELECT * FROM skyeu."savings" WHERE accountnumber = $1`;
        const loanAccountQuery = `SELECT * FROM skyeu."loanaccounts" WHERE accountnumber = $1`;
        const glAccountQuery = `SELECT * FROM skyeu."Accounts" WHERE accountnumber = $1`;
        const rotaryAccountQuery = `SELECT * FROM skyeu."rotaryaccount" WHERE accountnumber = $1`;
        const propertyAccountQuery = `SELECT * FROM skyeu."propertyaccount" WHERE accountnumber = $1`;
        let parsedAccountNumber = accountnumber;
        if (isNaN(accountnumber)) {
            parsedAccountNumber = parseInt(accountnumber, 10);
            if (isNaN(parsedAccountNumber)) {
                parsedAccountNumber = '0000000000'; // Default account number if parsing fails
            }
        }
        const accountResult = await client.query(savingsAccountQuery, [parsedAccountNumber]);
        const loanAccountResult = await client.query(loanAccountQuery, [parsedAccountNumber]);
        const glAccountResult = await client.query(glAccountQuery, [parsedAccountNumber]);
        const propertyAccountResult = await client.query(propertyAccountQuery, [parsedAccountNumber]);
        const rotaryAccountResult = await client.query(rotaryAccountQuery, [parsedAccountNumber]);
        console.log('accountnumber', accountnumber);

        if (accountResult.rowCount !== 0) {
            whichaccount = 'SAVINGS'; // Set account type to SAVINGS
            req.body.whichaccount = whichaccount;

            // check if the account status is ACTIVE else return
            if (accountResult.rows[0].status != 'ACTIVE') {
                return res.status(StatusCodes.EXPECTATION_FAILED).json({
                    status: false,
                    message: 'This account has been suspended. Please contact support or report to your nearest branch to complete your verification.',
                    errors: ['This account has been suspended. Please contact support or report to your nearest branch to complete your verification.']
                });
            }

        } else if (accountnumber && accountnumber.toString().startsWith(orgSettings.personal_account_prefix)) {
            const phoneNumber = accountnumber.substring(orgSettings.personal_account_prefix.length);
            const userQuery = `SELECT * FROM skyeu."User" WHERE phone = $1::text`;
            const userResult = await client.query(userQuery, [phoneNumber]);
            if (userResult.rowCount === 0) {
                // If not found in User table, check the Supplier table
                const supplierQuery = `SELECT * FROM skyeu."Supplier" WHERE contactpersonphone = $1`;
                const supplierResult = await client.query(supplierQuery, [phoneNumber]);
                if (supplierResult.rowCount === 0) {
                    // If personal account number is invalid, save the transaction as failed
                    await saveFailedTransaction(client, req, res, 'Invalid personal account number', await generateNewReference(client, accountnumber, req, res), whichaccount);
                    await client.query('COMMIT'); // Commit the transaction
                    await activityMiddleware(req, req.user.id, 'Transaction failed due to invalid personal account number', 'TRANSACTION');
                    req.transactionError = {
                        status: StatusCodes.EXPECTATION_FAILED,
                        message: 'Invalid personal or savings account number.',
                        errors: ['Account not found.']
                    }; 
                    req.body.transactiondesc += 'Invalid personal or savings account number.|';
                }
                req.body['personalaccountnumber'] = `${orgSettings.personal_account_prefix}${supplierResult.rows[0].contactpersonphone}`;
                personnalaccount = `${orgSettings.personal_account_prefix}${supplierResult.rows[0].contactpersonphone}`;
            }else{
                const accountuser = userResult.rows[0]; // Save the user data in accountuser variable
                console.log('accountuser', accountuser)
                req.body['personalaccountnumber'] = `${orgSettings.personal_account_prefix}${accountuser.phone}`;
                personnalaccount = `${orgSettings.personal_account_prefix}${accountuser.phone}`;
            }
            whichaccount = 'PERSONAL'; // Set account type to PERSONAL
            req.body.whichaccount = whichaccount;
        } else if (loanAccountResult.rowCount !== 0) {
            whichaccount = 'LOAN'; // Set account type to LOAN
            req.body.whichaccount = whichaccount;
            const loanaccountuser = loanAccountResult.rows[0]; // Save the user data in loanaccountuser variable
            req.body.loanaccountnumber = loanaccountuser.accountnumber;
            req.body.loanaccount = loanaccountuser;
        } else if (glAccountResult.rowCount !== 0) {
            whichaccount = 'GLACCOUNT'; // Set account type to GLACCOUNT
            req.body.whichaccount = whichaccount;
        } else if (propertyAccountResult.rowCount !== 0) {
            whichaccount = 'PROPERTY'; // Set account type to PROPERTY
            req.body.whichaccount = whichaccount;
        }else if (rotaryAccountResult.rowCount !== 0) {
            whichaccount = 'ROTARY'; // Set account type to ROTARY
            req.body.whichaccount = whichaccount;
        }

        // Establish the personal account number  
        if (!req.body['personalaccountnumber']) {
            req.body['personalaccountnumber'] = `${orgSettings.personal_account_prefix}${user.phone}`;
        }
        if (!personnalaccount) {
            req.body.phone = user.phone;
            personnalaccount = `${orgSettings.personal_account_prefix}${user.phone}`;
        }

        if (accountResult.rowCount) {
            const userQuery = `SELECT phone FROM skyeu."User" WHERE id = $1`;
            const userResult = await client.query(userQuery, [accountResult.rows[0].userid]);
            if (userResult.rowCount > 0) {
                const phone = userResult.rows[0].phone;
                req.body['personalaccountnumber'] = `${orgSettings.personal_account_prefix}${phone}`;
                req.body.phone = phone;
            }
        }

        if (loanAccountResult.rowCount) {
            const loanUserQuery = `SELECT phone FROM skyeu."User" WHERE id = $1`;
            const loanUserResult = await client.query(loanUserQuery, [loanAccountResult.rows[0].userid]);
            if (loanUserResult.rowCount > 0) {
                const phone = loanUserResult.rows[0].phone;
                req.body['loanaccountnumber'] = `${orgSettings.personal_account_prefix}${phone}`;
                req.body.phone = phone;
            }
        }

        if (propertyAccountResult.rowCount) {
            const propertyUserQuery = `SELECT phone FROM skyeu."User" WHERE id = $1`;
            const propertyUserResult = await client.query(propertyUserQuery, [propertyAccountResult.rows[0].userid]);
            if (propertyUserResult.rowCount > 0) {
                const phone = propertyUserResult.rows[0].phone;
                req.body['propertyaccountnumber'] = `${orgSettings.personal_account_prefix}${phone}`;
                req.body.phone = phone;
            }
        }

        if (rotaryAccountResult.rowCount) {
            const rotaryUserQuery = `SELECT phone FROM skyeu."User" WHERE id = $1`;
            const rotaryUserResult = await client.query(rotaryUserQuery, [rotaryAccountResult.rows[0].userid]);
            if (rotaryUserResult.rowCount > 0) {
                const phone = rotaryUserResult.rows[0].phone;
                req.body['rotaryaccountnumber'] = `${orgSettings.personal_account_prefix}${phone}`;
                req.body.phone = phone;
            }
        }

        // if(!req.body['personalaccountnumber']){
        //     return res.status(StatusCodes.BAD_REQUEST).json({
        //         status: false,
        //         message: 'phone number not found.',
        //         statuscode: StatusCodes.BAD_REQUEST,
        //         data: null,
        //         errors: ['Phone number not found.']
        //     });
        // }

        if (accountResult.rowCount === 0 && accountnumber 
                && !accountnumber.toString().startsWith(orgSettings.personal_account_prefix) 
                && loanAccountResult.rowCount === 0 
                && glAccountResult.rowCount === 0 
                && propertyAccountResult.rowCount === 0 
                && rotaryAccountResult.rowCount === 0) {
            // If account number is invalid, save the transaction as failed
            await saveFailedTransaction(client, req, res, 'Invalid account number', await generateNewReference(client, accountnumber, req, res), whichaccount);
            await client.query('COMMIT'); // Commit the transaction
            await activityMiddleware(req, req.user.id, 'Transaction committed after invalid account number', 'TRANSACTION');
            req.transactionError = {
                status: StatusCodes.EXPECTATION_FAILED,
                message: 'Invalid account number.',
                errors: ['Account not found.']
            };
            req.body.transactiondesc += 'Invalid account number.|';
            return next();
        }

        // Initialize transaction status and reason for rejection
        let transactionStatus = 'ACTIVE';
        let reasonForRejection = '';
        let reasonForPending = '';

        // Check for currency mismatch and date restrictions
        const currentDate = new Date();
        if (!orgSettings.allow_back_dated_transaction && new Date(transactiondate) < currentDate) {
            transactionStatus = 'FAILED';
            reasonForRejection = 'Back-dated transactions are not allowed';
            // Immediately save the transaction as failed and stop processing
            await saveFailedTransaction(client, req, res, reasonForRejection, await generateNewReference(client, accountnumber, req, res), whichaccount);
            await client.query('COMMIT'); // Commit the transaction
            await activityMiddleware(req, req.user.id, 'Transaction committed after back-dated transaction', 'TRANSACTION');
            req.transactionError = {
                status: StatusCodes.FAILED_DEPENDENCY,
                message: 'Transaction failed due to back-dated transaction.',
                errors: ['Back-dated transactions are not allowed.']
            };
            req.body.transactiondesc += 'Transaction failed due to back-dated transaction.|';
            return next();
        }
        if (!orgSettings.allow_future_transaction && new Date(transactiondate) > currentDate) {
            transactionStatus = 'FAILED';
            reasonForRejection = 'Future transactions are not allowed';
            // Immediately save the transaction as failed and stop processing
            await saveFailedTransaction(client, req, res, reasonForRejection, await generateNewReference(client, accountnumber, req, res), whichaccount);
            await client.query('COMMIT'); // Commit the transaction
            await activityMiddleware(req, req.user.id, 'Transaction committed after future transaction', 'TRANSACTION');
            req.transactionError = {
                status: StatusCodes.FAILED_DEPENDENCY,
                message: 'Transaction failed due to future transaction.',
                errors: ['Future transactions are not allowed.']
            };
            req.body.transactiondesc += 'Transaction failed due to future transaction.|';
            return next();
        }
        const rejectTransactionDateQuery = `SELECT * FROM skyeu."Rejecttransactiondate" WHERE rejectiondate = $1`;
        const rejectTransactionDateResult = await client.query(rejectTransactionDateQuery, [currentDate.toISOString().split('T')[0]]);
        if (rejectTransactionDateResult.rowCount > 0) {
            transactionStatus = 'FAILED';
            reasonForRejection = 'Transaction date is a rejected date';
            // Immediately save the transaction as failed and stop processing
            req.body.status = 'REJECTED';
            await saveFailedTransaction(client, req, res, reasonForRejection, await generateNewReference(client, accountnumber, req, res), whichaccount);
            await client.query('COMMIT'); // Commit the transaction
            await activityMiddleware(req, req.user.id, 'Transaction committed after rejected date', 'TRANSACTION');
            req.transactionError = {
                status: StatusCodes.FAILED_DEPENDENCY,
                message: 'Transaction failed due to rejected date.',
                errors: ['Transaction date is a rejected date.']
            };
            req.body.transactiondesc += 'Transaction date is a rejected date.|';
            return next();
        }
        
        // Get the user of the account number if it's a savings account      
        if (whichaccount === 'SAVINGS') {            
            accountuser = accountResult.rows[0]; // Get account user details
            console.log('as e dey hot', accountuser);
            req.body['userid'] = accountuser.userid; // Attach user ID to request body

            const account = accountResult.rows[0]; // Get account details
            if (account.status !== 'ACTIVE') {
                // If account is not active, save the transaction as failed
                await saveFailedTransaction(client, req, res, 'Account is not active.', await generateNewReference(client, accountnumber, req, res), whichaccount);
                await client.query('COMMIT'); // Commit the transaction
                await activityMiddleware(req, req.user.id, 'Transaction committed after inactive account', 'TRANSACTION');
                req.transactionError = {
                    status: StatusCodes.EXPECTATION_FAILED,
                    message: 'Account is not active.',
                    errors: ['Inactive account.']
                };
                req.body.transactiondesc += 'Account is not active.|';
                return next();
            }

            // Validate the savings product
            const savingsProductQuery = `SELECT * FROM skyeu."savingsproduct" WHERE id = $1`;
            const savingsProductResult = await client.query(savingsProductQuery, [account.savingsproductid]);
            if (savingsProductResult.rowCount === 0) {
                // If savings product is invalid, save the transaction as failed
                await saveFailedTransaction(client, req, res, 'Invalid savings product', await generateNewReference(client, accountnumber, req, res), whichaccount);
                await client.query('COMMIT'); // Commit the transaction
                await activityMiddleware(req, req.user.id, 'Transaction committed after invalid savings product', 'TRANSACTION');
                req.transactionError = {
                    status: StatusCodes.EXPECTATION_FAILED,
                    message: 'Invalid savings product.',
                    errors: ['Savings product not found.']
                };
                req.body.transactiondesc += 'Invalid savings product.|';
                return next();
            }

            const savingsProduct = savingsProductResult.rows[0]; // Get savings product details
            req.savingsProduct = savingsProduct;
            // Check for frequency override
            const frequencyOverrideQuery = `
                SELECT * FROM skyeu."frequencyoverride" 
                WHERE savingsproductid = $1 AND branch = $2 AND status = 'ACTIVE'
            `;
            const frequencyOverrideResult = await client.query(frequencyOverrideQuery, [savingsProduct.id, account.branch]);

            if (frequencyOverrideResult.rowCount > 0) {
                const frequencyOverride = frequencyOverrideResult.rows[0];
                savingsProduct.compulsorydepositfrequency = frequencyOverride.compulsorydepositfrequency; // Apply frequency override
                console.log('Frequency override applied:', savingsProduct.compulsorydepositfrequency);
            }

            // Check if savings product is inactive
            if (savingsProduct.status !== 'ACTIVE') {
                // If savings product is inactive, save the transaction as failed
                await saveFailedTransaction(client, req, res, 'Inactive savings product', await generateNewReference(client, accountnumber, req, res), whichaccount);
                await client.query('COMMIT'); // Commit the transaction
                await activityMiddleware(req, req.user.id, 'Transaction committed after inactive savings product', 'TRANSACTION');
                req.transactionError = {
                    status: StatusCodes.EXPECTATION_FAILED,
                    message: 'Savings product is not active.',
                    errors: ['Inactive savings product.']
                };
                req.body.transactiondesc += 'Savings product is not active.|';
                return next();
            }

            if (!currency || currency !== savingsProduct.currency) {
                transactionStatus = 'FAILED';
                reasonForRejection = 'Currency mismatch or not provided';
                // Immediately save the transaction as failed and stop processing
                await saveFailedTransaction(client, req, res, reasonForRejection, await generateNewReference(client, accountnumber, req, res), whichaccount);
                await client.query('COMMIT'); // Commit the transaction
                await activityMiddleware(req, req.user.id, 'Transaction committed after currency mismatch', 'TRANSACTION');
                req.transactionError = {
                    status: StatusCodes.EXPECTATION_FAILED,
                    message: 'Transaction failed due to currency mismatch.',
                    errors: ['Currency mismatch or not provided.']
                };
                return next();
            }    

            // Handle credit and debit for savings account
            await savingsCredit(client, req, res, next, accountnumber, credit, description, ttype, transactionStatus, savingsProduct, whichaccount, req.user.id);
            await savingsDebit(client, req, res, next, accountnumber, debit, description, ttype, transactionStatus, savingsProduct, whichaccount, accountuser);
        }

        // Handle transactions for personal accounts
        if (whichaccount === 'PERSONAL') {            
            if(Number(req.body.credit)>0)await personalCredit(client, req, res, next, req.body.personalaccountnumber, credit, description, ttype, transactionStatus, whichaccount);
            if(Number(req.body.debit)>0)await personalDebit(client, req, res, next, req.body.personalaccountnumber, debit, description, ttype, transactionStatus, whichaccount);
        }     

        // Handle transactions for loan accounts
        if (whichaccount === 'LOAN') {
            if(Number(req.body.credit)>0)await loanCredit(client, req, res, next, req.body.loanaccountnumber, credit, description, ttype, transactionStatus, whichaccount);
            if(Number(req.body.debit)>0)await loanDebit(client, req, res, next, req.body.loanaccountnumber, credit, description, ttype, transactionStatus, whichaccount);
        }

        // Handle transactions for gl accounts
        if (whichaccount === 'GLACCOUNT') {
            if(Number(req.body.credit)>0)await glAccountCredit(client, req, res, next, req.body.accountnumber, credit, description, ttype, transactionStatus, whichaccount);
            if(Number(req.body.debit)>0)await glAccountDebit(client, req, res, next, req.body.accountnumber, debit, description, ttype, transactionStatus, whichaccount);
        }
        
        // Handle transactions for property accounts
        if (whichaccount === 'PROPERTY') {
            if(Number(req.body.credit)>0)await propertyAccountCredit(client, req, res, next, req.body.accountnumber, credit, description, ttype, transactionStatus, whichaccount);
            if(Number(req.body.debit)>0)await propertyDebit(client, req, res, next, req.body.accountnumber, debit, description, ttype, transactionStatus, whichaccount);
        }
 
        // Handle transactions for rotary accounts
        if (whichaccount === 'ROTARY') {
            if(Number(req.body.credit)>0)await rotaryCredit(client, req, res, next, req.body.accountnumber, credit, description, ttype, transactionStatus, whichaccount);
            if(Number(req.body.debit)>0)await rotaryDebit(client, req, res, next, req.body.accountnumber, debit, description, ttype, transactionStatus, whichaccount);
        }

        // Log activity for successful transaction save
        await activityMiddleware(req, req.user.id, 'Transaction saved successfully', 'TRANSACTION');

        await client.query('COMMIT'); // Commit the transaction
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback the transaction on error
        console.error('Transaction failed at:', error.stack);
        
        // Logic to save failed transaction with reason for rejection
        if (reasonForRejection) {
            await saveFailedTransaction(client, req, res, reasonForRejection, await generateNewReference(client, accountnumber, req, res), whichaccount);
            await client.query('COMMIT'); // Commit the transaction
            req.transactionError = {
                status: StatusCodes.EXPECTATION_FAILED,
                message: 'Transaction processing failed.',
                errors: [error.message]
            };
        }
 
        // If tfrom is BANK, save the transaction to default_excess_account
        if (tfrom === 'BANK') {
            const excessAccountNumber = orgSettings.default_excess_account;
            req.body.transactiondesc += `Original Account Number: ${accountnumber}, Description: ${description}, Branch: ${branch}, Registration Point: ${registrationpoint}`;
            await saveTransaction(client, res, {
                accountnumber: excessAccountNumber,
                credit,
                debit,
                description,
                ttype,
                status: transactionStatus,
                whichaccount
            }, req);
            await client.query('COMMIT'); // Commit the transaction
        }
        
        req.transactionError = {
            status: StatusCodes.EXPECTATION_FAILED,
            message: 'Transaction processing failed.',
            errors: [error.message]
        };
    } finally {
        return next(); // Proceed to the next middleware
    }
};


module.exports = saveTransactionMiddleware; // Export the middleware function