const { StatusCodes } = require('http-status-codes');
const { activityMiddleware } = require('../middleware/activity');
const { sendEmail } = require('./sendEmail');


// if (savingsProduct.withdrawalcharges > 0) {
//     await applyWithdrawalCharge(client, req, res, accountnumber, debit, whichaccount);
// }

async function applyWithdrawalCharge(client, req, res, accountnumber, debit, whichaccount) {
    console.log('req', req);
    const chargeAmount = await calculateChargedebit(req.savingsProduct, debit); // Calculate the charge amount
    console.log('chargeamount', chargeAmount);
    const transactionParams = {
        accountnumber: accountnumber,
        debit: chargeAmount, 
        description: 'Withdrawal Charge',
        reference: await generateNewReference(client, accountnumber, req, res),
        status: 'ACTIVE',
        ttype: 'CHARGE',
        whichaccount: whichaccount
    };
    await saveTransaction(client, res, transactionParams, req); // Call the saveTransaction function
    await activityMiddleware(req, req.user.id, ' withdrawal charge transaction saved', 'TRANSACTION'); // Log activity

    // Credit the charge amount to the organisation's default income account
    const incomeAccountParams = {
        accountnumber: req.orgSettings.default_income_account,
        credit: chargeAmount,
        description: 'Withdrawal Charge Income',
        reference: transactionParams.reference,
        status: 'ACTIVE',
        ttype: 'INCOME',
        whichaccount: 'INCOME'
    };
    await saveTransaction(client, res, incomeAccountParams, req); // Save the income transaction
    await activityMiddleware(req, req.user.id, 'Withdrawal charge credited to default income account', 'TRANSACTION');
}

async function applySavingsCharge(client, req, res, accountnumber, credit, whichaccount) {
    const chargeAmount = await calculateCharge(req.savingsProduct, credit); // Calculate the charge amount
    console.log('chargeamount', chargeAmount);
    const transactionParams = {
        accountnumber: accountnumber,
        debit: chargeAmount,
        description: 'Savings Charge',
        reference: await generateNewReference(client, accountnumber, req, res),
        status: 'ACTIVE',
        ttype: 'CHARGE',
        whichaccount: whichaccount
    };
    await saveTransaction(client, res, transactionParams, req); // Call the saveTransaction function
    await activityMiddleware(req, req.user.id, 'savings charge transaction saved', 'TRANSACTION'); // Log activity

    // Credit the charge amount to the organisation's default income account
    const incomeAccountParams = {
        accountnumber: req.orgSettings.default_income_account,
        credit: chargeAmount,
        description: 'Savings Charge Income',
        reference: transactionParams.reference,
        status: 'ACTIVE',
        ttype: 'INCOME',
        whichaccount: 'INCOME'
    };
    await saveTransaction(client, res, incomeAccountParams, req); // Save the income transaction
    await activityMiddleware(req, req.user.id, 'Savings charge credited to default income account', 'TRANSACTION');
}



// take charges
async function takeCharges(client, req, res) {
    try {
        if (req.body.whichaccount === 'SAVINGS') {
            // const savingsProductQuery = `SELECT * FROM sky."savingsproduct" WHERE id = $1`;
            // const savingsProductResult = await client.query(savingsProductQuery, [req.body.savingsproductid]);

            if ( req.body.ttype !== 'CHARGE' && req.body.ttype !== 'PENALTY') {
                // const savingsProduct = savingsProductResult.rows[0];

                if (req.body.credit > 0) {
                    // Apply credit charge
                    await applySavingsCharge(client, req, res, req.body.accountnumber, req.body.credit, req.body.whichaccount);
                } else if (req.body.debit > 0) {
                    // Apply debit charge
                    await applyWithdrawalCharge(client, req, res, req.body.accountnumber, req.body.debit, req.body.whichaccount);
                }
            } else {
                // req.body.transactiondesc += `Savings product not found for account ${req.body.accountnumber}.|`;
            }
        }
    } catch (error) {
        console.error('Error taking charges:', error.stack);
        req.body.transactiondesc += `Error taking charges: ${error.message}.|`;
        throw new Error('Error taking charges');
    }
}


// Function to save failed transaction with reason for rejection
const saveFailedTransaction = async (client, req, res, reasonForRejection, transactionReference, whichaccount) => {
    transactionReference = await generateNewReference(client, req.body.accountnumber, req);
    const createdBy = req.user.id || req.body.createdby || 0;
    let userid = req.user.id;

    req.body.transactiondesc += `Transaction failed due to: ${reasonForRejection}.|`;

    if (req.body.tfrom === 'CASH') {
        // if (req.body.credit > 0) {
        //     // Redirect to default excess account
        //     const defaultExcessAccount = req.orgSettings.default_excess_account || '999999999';
        //     await  handleRedirection(client, req, res, userid, transactionReference, reasonForRejection, whichaccount);
        //     await client.query('COMMIT'); // Commit the transaction
        //     await activityMiddleware(req, req.user.id, 'Transaction committed after redirecting to default excess account', 'TRANSACTION');
        //     req.transactionError = {
        //         status: StatusCodes.MISDIRECTED_REQUEST,// Check if there is a withdrawal charge applicable
            
        //         message: `Transaction has been redirected to the default excess account because ${reasonForRejection}`,
        //         errors: [`${reasonForRejection}. Transaction redirected to default excess account.`]
        //     };
        //     req.body.transactiondesc += 'This Deposit not allowed on this product.|';
        //     return;
        // } else if (req.body.debit > 0) {
            // Fail the transaction
            const status = 'FAILED';
            if(!req.body.transactionref)req.body.transactionref = '';
            if(!req.body.cashref)req.body.cashref = '';
            await client.query(
                `INSERT INTO sky."transaction" (accountnumber, credit, debit, reference, description, ttype, status, transactiondesc, whichaccount, dateadded, createdby, currency, userid, transactiondate, tfrom, transactionref, cashref, branch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, $11, $12, now(), $13, $14, $15, $16)`,
                [req.body.accountnumber, req.body.credit, req.body.debit, transactionReference, req.body.description, req.body.ttype, status, reasonForRejection, req.body.whichaccount, createdBy, req.body.currency, userid, req.body.tfrom, req.body.transactionref??'', req.body.cashref??'', req.body.branch]
            );
            req.transactionError = {
                status: StatusCodes.BAD_REQUEST,
                message: req.body.credit > 0 ? `Credit transaction failed because ${reasonForRejection}.` : `Debit transaction failed because ${reasonForRejection}.`,
                errors: [req.body.credit > 0 ? `Credit transaction failed because ${reasonForRejection}.` : `Debit transaction failed because ${reasonForRejection}.`]
            };
            req.body.transactiondesc += req.body.credit > 0 ? `Credit transaction failed because ${reasonForRejection}.|` : `Debit transaction failed because ${reasonForRejection}.|`;
            return;
        // }
    }

    if (req.body.tfrom === 'BANK') { 
        // Redirect to default excess account
        await takeCharges(client, req, res)
        const defaultExcessAccount = req.orgSettings.default_excess_account || '999999999';

        await handleRedirection(client, req, res, userid, transactionReference, reasonForRejection, req.body.whichaccount, req.body.credit);
        await client.query('COMMIT'); // Commit the transaction
        await activityMiddleware(req, req.user.id, 'Transaction committed after redirecting to default excess account', 'TRANSACTION');
        req.transactionError = {
            status: StatusCodes.MISDIRECTED_REQUEST,
            message: `Transaction has been redirected to the default excess account because ${reasonForRejection}`,
            errors: [`${reasonForRejection}. Transaction redirected to default excess account.`]
        };
        req.body.transactiondesc += `${reasonForRejection}. Transaction redirected to default excess account. |`;
        return;
    }
};

// Function to save pending transaction with reason for pending
const savePendingTransaction = async (client, accountnumber, credit, debit, transactionReference, description, ttype, reasonForRejection, status, whichaccount, req) => {
    const createdBy = req.user.id || req.body.createdby || 0;
    let userid = req.user.id;

    // if (whichaccount !== 'GLACCOUNT') {
    //     const accountQuery = `SELECT userid FROM sky."${whichaccount.toLowerCase()}" WHERE accountnumber = $1`;
    //     const accountResult = await client.query(accountQuery, [accountnumber]);
    //     if (accountResult.rowCount !== 0) {
    //         userid = accountResult.rows[0].userid;
    //     }
    // }
 
    const valuedate = status === 'ACTIVE' ? new Date() : null;
    const newReference = await generateNewReference(client, accountnumber, req);

    if (req.body.tfrom === 'CASH') {
        // Fail the transaction
        status = 'FAILED';
        reasonForRejection = `Transaction failed due to: ${reasonForRejection}.`;
    } else if (req.body.tfrom === 'BANK') {
        await takeCharges(client, req)
        // Redirect the transaction
        if (debit > 0) {
            await saveTransaction(client, null, {
                accountnumber,
                credit: 0,
                debit,
                reference: newReference,
                description,
                ttype,
                status: "ACTIVE",
                transactiondesc: reasonForRejection+" But account overdrawn",
                whichaccount,
                currency: req.body.currency,
                tfrom: req.body.tfrom
            }, req);
        } else {
            const defaultExcessAccount = req.orgSettings.default_excess_account || '999999999';
            await handleRedirection(client, req, null, userid, transactionReference, reasonForRejection, whichaccount, credit);
            reasonForRejection = `${reasonForRejection}. Transaction redirected to default excess account.`;
        }
    }

    // await client.query(
    //     `INSERT INTO sky."transaction" (accountnumber, credit, debit, reference, description, ttype, status, transactiondesc, whichaccount, dateadded, createdby, currency, userid, transactiondate, valuedate, tfrom) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, $11, $12, now(), $13, $14)`,
    //     [accountnumber, credit, debit, newReference, description, ttype, status, reasonForRejection, req.body.whichaccount, createdBy, req.body.currency, userid, valuedate, req.body.tfrom]
    // );

    // req.body.transactiondesc += reasonForRejection + '|';

    // if (req && req.reference && ttype !== 'CHARGE') {
    //     await client.query(
    //         `UPDATE sky."transaction" SET status = 'FAILED' WHERE reference LIKE $1`,
    //         [req.reference + '%']
    //     );
    // }
};

// Function to save a transaction
const saveTransaction = async (client, res, transactionData, req) => {
    try {
        console.log('description',   transactionData.description, req.body)
        const {
            accountnumber,
            credit = 0,
            debit = 0,
            reference,
            description = req.body ? req.body.description : '',
            ttype = req.body ? req.body.ttype : '',
            status = 'ACTIVE',
            transactiondate = req.body ? req.body.transactiondate || new Date() : new Date(),
            // whichaccount = req.body.whichaccount??'',
            valuedate = req.body ? req.body.valuedate || new Date() : new Date(),
            transactiondesc = req.body ? req.body.transactiondesc || '' : '',
            currency = req.body ? req.body.currency : '',
            tfrom = req.body ? req.body.tfrom : '',
            transactionref = req.body ? req.body.transactionref??'' : '',
            cashref = req.body ? req.body.cashref??'' : '',
        } = transactionData;

        const createdBy = (req.user && req.user.id) || (req.body.createdby ?? 0) || 0;
        let userid = req.user.id;

        // if (whichaccount !== 'GLACCOUNT') {
        //     const accountQuery = `SELECT userid FROM sky."${whichaccount.toLowerCase()}" WHERE accountnumber = $1`;
        //     const accountResult = await client.query(accountQuery, [accountnumber]);
        //     if (accountResult.rowCount !== 0) {
        //         userid = accountResult.rows[0].userid;
        //     }
        // }

        const finalValuedate = status === 'ACTIVE' ? new Date() : null;
        const newReference = await generateNewReference(client, accountnumber, req);
        await client.query(
            `INSERT INTO sky."transaction" (accountnumber, credit, debit, reference, description, ttype, status, transactiondate, whichaccount, valuedate, transactiondesc, dateadded, createdby, currency, userid, tfrom, transactionref, cashref, branch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), $12, $13, $14, $15, $16, $17, $18)`,
            [accountnumber, credit, debit, newReference, description, ttype, status, transactiondate, req.body.whichaccount, finalValuedate, transactiondesc, createdBy, currency, userid, tfrom, transactionref, cashref, req.body.branch]
        );
        req.body.transactiondesc += 'Transaction saved successfully.|';

        // Send notification email to the user of the transaction with comprehensive details
        const userQuery = `SELECT userid FROM sky."savings" WHERE accountnumber = $1`;
        const userResult = await client.query(userQuery, [accountnumber]);

        if (userResult.rowCount > 0) {
            const userid = userResult.rows[0].userid;

            // Fetch user email
            const emailQuery = `SELECT email, firstname FROM sky."User" WHERE id = $1`;
            const emailResult = await client.query(emailQuery, [userid]);

            if (emailResult.rowCount > 0) {
                const userEmail = emailResult.rows[0].email;

                // Fetch the new balance
                const balanceQuery = `SELECT SUM(credit) - SUM(debit) as balance FROM sky."transaction" WHERE accountnumber = $1 AND status = 'ACTIVE'`;
                const balanceResult = await client.query(balanceQuery, [accountnumber]);
                const newBalance = balanceResult.rows[0].balance;

                // Construct comprehensive transaction details
                const transactionDetails = `
                    <p>Dear ${emailResult.rows[0].firstname},</p>
                    <p>Your transaction has been processed successfully with the following details:</p>
                    <ul>
                        <li><strong>Account Number:</strong> ${accountnumber}</li>
                        <li><strong>Transaction Type:</strong> ${ttype}</li> 
                        <li><strong>Amount:</strong> ${credit >0 ? credit : debit}</li>
                        <li><strong>Reference:</strong> ${newReference}</li>
                        <li><strong>Description:</strong> ${description}</li>
                        <li><strong>Status:</strong> ${status=='ACTIVE'?'Processed':status}</li>
                        <li><strong>Transaction Date:</strong> ${new Date(transactiondate).toLocaleString('en-US', { timeZone: 'America/New_York' })}</li>
                        <li><strong>New Balance:</strong> ${newBalance}</li>
                    </ul>
                    <p>Thank you for banking with us.</p>
                `;

                // Determine the alert type for the email subject
                const alertType = credit > 0 ? 'Credit Alert' : 'Debit Alert';

                // Send email notification
                await sendEmail({
                    to: userEmail,
                    subject: `${alertType} from SkyTrust Bank`,
                    text: `Your transaction has been processed successfully.`,
                    html: transactionDetails
                });

                req.body.transactiondesc += 'Notification email sent successfully.|';
            } else {
                req.body.transactiondesc += 'User email not found. Notification email not sent.|';
            }
        } else {
            req.body.transactiondesc += 'User ID not found from account number. Notification email not sent.|';
        }
    } catch (error) {
        console.error('Error saving transaction:', error.stack);
        req.body.transactiondesc += `Transaction failed due to error: ${error.message}.|`;
        throw new Error('Transaction failed due to error.');
    }
};

// Helper function for calculating charges
const calculateCharge = (product, amount) => {
    // console.log(product, product.depositechargetype, product.depositcharge, amount)
    console.log('depositcharge', 999999, product.depositcharge, amount, product)
    if (product.depositechargetype === 'PERCENTAGE') {
        return (product.depositcharge / 100) * amount;
    }
    return product.depositcharge;
};
// Helper function for calculating charges
const calculateChargedebit = (product, amount) => {
    // console.log(product, product.depositechargetype, product.depositcharge, amount)
    console.log('withdrawalcharges', 999999, product.withdrawalcharges, amount, product)
    if (product.withdrawalchargetype === 'PERCENTAGE') {
        return (product.withdrawalcharges / 100) * amount;
    }
    return product.withdrawalcharges;
};


const applyMinimumCreditAmountPenalty = async (client, req, res, orgSettings) => {
    if (req.body.credit < orgSettings.minimum_credit_amount && req.body.ttype != 'CHARGE') {
        const penaltyAmount = orgSettings.minimum_credit_amount_penalty;
        const defaultIncomeAccountNumber = orgSettings.default_income_account;
        const incomeAccountQuery = `SELECT * FROM sky."Accounts" WHERE accountnumber = $1`;
        const incomeAccountResult = await client.query(incomeAccountQuery, [defaultIncomeAccountNumber]);
        let continued = true
        if (req.body.whichaccount == 'PERSONAL') {
            const userQuery = `SELECT id FROM sky."User" WHERE phone = $1`;
            const userResult = await client.query(userQuery, [req.body.accountnumber.toString().replace(orgSettings.personal_account_prefix, '')]);

            if (userResult.rowCount === 0) {
                req.body.transactiondesc += 'Account seems like a supplier / non-member account. Penalty cannot proceed.|';
                continued = false;
            }
        }
        
        if(continued){
            if (incomeAccountResult.rowCount === 0) {
                req.body.transactiondesc += 'Default income account does not exist. Please contact support for assistance.|';
                const excessAccountNumber = orgSettings.default_excess_account || '999999999';
                await saveTransaction(client, res, {
                    accountnumber: excessAccountNumber,
                    credit: penaltyAmount,
                    debit: 0,
                    reference: await generateNewReference(client, excessAccountNumber, req, res),
                    description: 'Penalty saved to excess account',
                    ttype: 'PENALTY',
                    status: 'ACTIVE',
                    transactiondesc: 'Penalty saved to excess account',
                    whichaccount: 'GLACCOUNT',
                    currency: req.body.currency,
                    tfrom: req.body.tfrom
                }, req);
                req.body.transactiondesc += `Penalty of ${penaltyAmount} has been saved to excess account.|`;
                await activityMiddleware(req, req.user.id, 'Penalty transaction saved to excess account', 'TRANSACTION');
                // throw new Error('Default income account does not exist. Please contact support for assistance.');
            } else {
                console.log('Penalty Amount:', penaltyAmount);
        
                await saveTransaction(client, res, {
                    accountnumber: defaultIncomeAccountNumber,
                    credit: penaltyAmount,
                    debit: 0,
                    reference: await generateNewReference(client, defaultIncomeAccountNumber, req, res),
                    description: 'Minimum Credit Amount Penalty',
                    ttype: 'PENALTY',
                    status: 'ACTIVE',
                    transactiondesc: 'Minimum Credit Amount Penalty',
                    whichaccount: 'GLACCOUNT',
                    currency: req.body.currency,
                    tfrom: req.body.tfrom
                }, req);
                req.body.transactiondesc += `Penalty of ${penaltyAmount} has been deducted.|`;
                req.body.credit = req.body.credit - penaltyAmount;
                await activityMiddleware(req, req.user.id, 'Penalty transaction saved', 'TRANSACTION');
            }
        }
    } 
};

// Helper function for penalty calculation
const calculatePenalty = (product) => {  
    if (product.penaltytype === 'PERCENTAGE') {
        return (product.penaltyamount / 100) * product.compulsorydepositfrequencyamount;
    }
    return product.penaltyamount;
};

// Helper function for calculating tax
const calculateTax = (transaction) => {
    // Define your tax calculation logic here
    return 0; // Replace with actual logic
};

// Example of generating a new reference
const generateNewReference = async (client, accountnumber, req) => {
    // prefix|'L'link|timestamp|identifier
    let prefix = '';
    let identifier = '';
    let link = '';

    console.log('accontnumber when generating ref', accountnumber)

    if (accountnumber.toString().startsWith(req.orgSettings.personal_account_prefix)) {
        // Check if the account number starts with personal account prefix
        console.log('orgSettings personal_transaction_prefix', req.orgSettings.personal_transaction_prefix) 
        prefix = req.orgSettings.personal_transaction_prefix;
        identifier = '7P8L9';
        req.body.whichaccount = 'PERSONAL';
    } 
    // Check if the account number is in the savings table
    if(!prefix && !identifier){
        const savingsQuery = `SELECT * FROM sky."savings" WHERE accountnumber = $1`;
        const savingsResult = await client.query(savingsQuery, [accountnumber]);
        if (savingsResult.rowCount !== 0) {
            console.log('orgSettings savings_transaction_prefix', req.orgSettings.savings_transaction_prefix) 
            prefix = req.orgSettings.savings_transaction_prefix;
            identifier = '1S2V3';
            req.body.whichaccount = 'SAVINGS';
        } else {
            // Check if the account number is in the Accounts table
            const accountsQuery = `SELECT * FROM sky."Accounts" WHERE accountnumber = $1`;
            const accountsResult = await client.query(accountsQuery, [accountnumber]);
            if (accountsResult.rowCount !== 0) {
                console.log('orgSettings gl_transaction_prefix', req.orgSettings.gl_transaction_prefix) 
                prefix = req.orgSettings.gl_transaction_prefix;
                identifier = '9G8L7';
                req.body.whichaccount = 'GLACCOUNT';
            } else {
                // Check if the account number is in the loan table
                const loanQuery = `SELECT * FROM sky."loanaccounts" WHERE accountnumber = $1`;
                const loanResult = await client.query(loanQuery, [accountnumber]);
                if (loanResult.rowCount !== 0) {
                    prefix = req.orgSettings.loan_transaction_prefix;
                    identifier = '4L5N6';
                    req.body.whichaccount = 'LOAN';
                } else {
                    // If the account number can't be matched to anything, throw a response
                    req.transactionError = {
                        status: StatusCodes.BAD_REQUEST,
                        message: 'Invalid account number.',
                        errors: ['Account number does not match any known account types while trying to generate reference.']
                    };
                    req.body.transactiondesc += 'Invalid account number.|';
                    return;
                }
            }
        }
    }

    // if(!prefix && !identifier){
    //     prefix = '000';
    //     identifier = '9U4K3N';
    // }

    console.log('whichaccount', req.body.whichaccount)

    // Check if the needed prefix is set, if not return response
    if (!prefix) {
       req.transactionError = {
            status: StatusCodes.BAD_REQUEST,
            message: 'Transaction prefix not set.',
            errors: ['The required transaction prefix is not set for the account type.']
        };
        req.body.transactiondesc += 'Transaction prefix not set.|';
        return;
    }

    // Generate the link
    const timestamp = Number(String(new Date().getTime()+Math.random()).replace('.',''));
    if (req.body.reference) {
        link = req.body.reference.includes('|') ? req.body.reference.split('|')[1] : 'B-'+req.body.reference;
    } else {
        link = `S-${timestamp}`;
    }

    // Construct the new reference
    const newReference = `${prefix}|${link}|${timestamp}|${identifier}`;
    req.body.reference = newReference;
    console.log('newReference', newReference)
    return newReference; 
}; 

// Example of sending notifications
const sendNotification = async (user, transaction) => {
    // Implement your notification logic here
}; 
 
// Example function to handle excess account logic for credit
const handleCreditRedirectToPersonnalAccount = async (client, req, res, accountuser, reference, transactiondesc, whichaccount, credit) => {
    // Implement logic for handling excess accounts
    const createdBy = req.user.id || req.body.createdby || 0;
    let userid = req.user.id;

    // if (whichaccount !== 'GLACCOUNT') {
    //     const accountQuery = `SELECT userid FROM sky."${whichaccount.toLowerCase()}" WHERE accountnumber = $1`;
    //     const accountResult = await client.query(accountQuery, [req.body.accountnumber]);
    //     if (accountResult.rowCount !== 0) {
    //         userid = accountResult.rows[0].userid;
    //     } 
    // } 
 
    // save the transaction as redirect 
    console.log('credit', credit, req.body.credit)
    let status = req.body.status === 'REJECTED' ? 'REJECTED' : 'REDIRECTED';
    const newReference = await generateNewReference(client, req.body.accountnumber, req);
    if (!req.body.transactionref) req.body.transactionref = '';
    if (!req.body.cashref) req.body.cashref = '';
    await client.query(
        `INSERT INTO sky."transaction" (accountnumber, credit, debit, reference, description, ttype, status, transactiondesc, whichaccount, dateadded, createdby, currency, userid, transactiondate, tfrom, transactionref, cashref, branch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, $11, $12, now(), $13, $14, $15, $16)`,
        [req.body.accountnumber, credit ? credit : req.body.credit, 0, newReference, req.body.description, req.body.ttype, 'REDIRECTED', transactiondesc, req.body.whichaccount, createdBy, req.body.currency, userid, req.body.tfrom, req.body.transactionref ?? '', req.body.cashref ?? '', req.body.branch]
    );
    req.body.transactiondesc += `Credit redirected from ${req.body.accountnumber} to personal account.|`;
    
    // Check if phone number is provided in the request body
    if (req.body.phone) {
        // Query the user table to find the user with the provided phone number
        const userQuery = `SELECT id, phone FROM sky."User" WHERE phone = $1`;
        const userResult = await client.query(userQuery, [req.body.phone]);

        if (userResult.rowCount > 0) {
            // If user is found, set the personal account number
            
        } else {
            // If user is not found, set the personal account number to the default excess account
            req.body.personalaccountnumber = req.orgSettings.default_excess_account || '999999999';
            req.body.transactiondesc += `User with phone number ${req.body.phone} not found. Personal account could not be found, redirected again to company's excess account.|`;
        }
    } else {
        // If phone number is not provided, set the personal account number to the default excess account
        req.body.personalaccountnumber = req.orgSettings.default_excess_account;
        req.body.transactiondesc += `Phone number not provided. Personal account could not be found, redirected again to company's excess account.|`;
    }
    status = req.body.status === 'REJECTED' ? 'REJECTED' : 'ACTIVE';
    const newPersonalReference = await generateNewReference(client, req.body.personalaccountnumber, req);
    if (!req.body.transactionref) req.body.transactionref = '';
    if (!req.body.cashref) req.body.cashref = '';
    await client.query(
        `INSERT INTO sky."transaction" (accountnumber, credit, debit, reference, description, ttype, status, transactiondesc, whichaccount, dateadded, createdby, currency, userid, transactiondate, valuedate, tfrom, transactionref, cashref, branch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, $11, $12, now(), now(), $13, $14, $15, $16)`,
        [req.body.personalaccountnumber, credit ? credit : req.body.credit, 0, newPersonalReference, req.body.description, req.body.ttype, status, `hcrCredit was to ${req.body.accountnumber}`, req.body.whichaccount, createdBy, req.body.currency, userid, req.body.tfrom, req.body.transactionref ?? '', req.body.cashref ?? '', req.body.branch]
    );
    
};    

// Example function to handle excess account logic for credit
const handleRedirection = async (client, req, res, accountuser, reference, transactiondesc, whichaccount, credit, debit) => {
    // Implement logic for handling excess accounts
    const createdBy = req.user.id || req.body.createdby || 0;
    let userid = req.user.id;

    // save the transaction as redirect 
    console.log('credit', credit, req.body.credit);
    let status = req.body.status === 'REJECTED' ? 'REJECTED' : 'REDIRECTED';
    const newReference = await generateNewReference(client, req.body.accountnumber, req);
    if (!req.body.transactionref) req.body.transactionref = '';
    if (!req.body.cashref) req.body.cashref = '';
    await client.query(
        `INSERT INTO sky."transaction" (accountnumber, credit, debit, reference, description, ttype, status, transactiondesc, whichaccount, dateadded, createdby, currency, userid, transactiondate, tfrom, transactionref, cashref, branch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, $11, $12, now(), $13, $14, $15, $16)`,
        [req.body.accountnumber, credit ? credit : req.body.credit, debit ? debit : req.body.debit, newReference, req.body.description, req.body.ttype, 'REDIRECTED', transactiondesc, whichaccount, createdBy, req.body.currency, userid, req.body.tfrom, req.body.transactionref ?? '', req.body.cashref ?? '', req.body.branch]
    );

    if ((credit ? credit : req.body.credit) > 0) {
        req.body.transactiondesc += `Credit redirected from ${req.body.accountnumber} to personal account.|`;
    } else if ((debit ? debit : req.body.debit) > 0 && req.body.tfrom === 'BANK') {
        req.body.transactiondesc += `Debit redirected from ${req.body.accountnumber} to personal account.|`;
    }

    // Check if phone number is provided in the request body
    if (req.body.phone) {
        // Query the user table to find the user with the provided phone number
        const userQuery = `SELECT id, phone FROM sky."User" WHERE phone = $1`;
        const userResult = await client.query(userQuery, [req.body.phone]);

        if (userResult.rowCount > 0) {
            // If user is found, set the personal account number
        } else {
            // If user is not found, handle based on transaction type
            if ((debit ? debit : req.body.debit) > 0 && req.body.tfrom === 'BANK') {
                // Debit the account it's meant to redirect from
                req.body.personalaccountnumber = req.body.accountnumber;
                req.body.transactiondesc += `User with phone number ${req.body.phone} not found. Debit transaction could not be redirected, debited from original account.|`;
            } else {
                // Redirect credit to the default excess account
                req.body.personalaccountnumber = req.orgSettings.default_excess_account || '999999999';
                req.body.transactiondesc += `User with phone number ${req.body.phone} not found. Personal account could not be found, redirected again to company's excess account.|`;
            }
        }
    } else {
        // If phone number is not provided, handle based on transaction type
        if ((debit ? debit : req.body.debit) > 0 && req.body.tfrom === 'BANK') {
            // Debit the account it's meant to redirect from
            req.body.personalaccountnumber = req.body.accountnumber;
            req.body.transactiondesc += `Phone number not provided. Debit transaction could not be redirected, debited from original account.|`;
        } else {
            // Redirect credit to the default excess account
            req.body.personalaccountnumber = req.orgSettings.default_excess_account;
            req.body.transactiondesc += `Phone number not provided. Personal account could not be found, redirected again to company's excess account.|`;
        }
    }
    status = req.body.status === 'REJECTED' ? 'REJECTED' : 'ACTIVE';
    const newPersonalReference = await generateNewReference(client, req.body.personalaccountnumber, req);
    if (!req.body.transactionref) req.body.transactionref = '';
    if (!req.body.cashref) req.body.cashref = '';
    await client.query(
        `INSERT INTO sky."transaction" (accountnumber, credit, debit, reference, description, ttype, status, transactiondesc, whichaccount, dateadded, createdby, currency, userid, transactiondate, valuedate, tfrom, transactionref, cashref, branch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, $11, $12, now(), now(), $13, $14, $15, $16)`,
        [req.body.personalaccountnumber, credit ? credit : req.body.credit, debit ? debit : req.body.debit, newPersonalReference, `Transaction redirected from ${req.body.accountnumber}`, req.body.ttype, status, transactiondesc, req.body.whichaccount, createdBy, req.body.currency, userid, req.body.tfrom, req.body.transactionref ?? '', req.body.cashref ?? '', req.body.branch]
    );
};

// Example function to handle excess account logic for debit
const handleDebitRedirectToPersonnalAccount = async (client, req, res, accountuser, reference, transactiondesc, whichaccount, debit) => {
    // Implement logic for handling excess accounts
    const createdBy = req.user.id || req.body.createdby || 0;
    let userid = req.user.id;

    // if (whichaccount !== 'GLACCOUNT') {
    //     const accountQuery = `SELECT userid FROM sky."${whichaccount.toLowerCase()}" WHERE accountnumber = $1`;
    //     const accountResult = await client.query(accountQuery, [req.body.accountnumber]);
    //     if (accountResult.rowCount !== 0) {
    //         userid = accountResult.rows[0].userid;
    //     } 
    // } 

    // save the transaction as redirect 
    console.log('debit', debit, req.body.debit)
    let status = req.body.status === 'REJECTED' ? 'REJECTED' : 'REDIRECTED';
    const newReference = await generateNewReference(client, req.body.accountnumber, req);
    if (!req.body.transactionref) req.body.transactionref = '';
    if (!req.body.cashref) req.body.cashref = '';
    await client.query(
        `INSERT INTO sky."transaction" (accountnumber, credit, debit, reference, description, ttype, status, transactiondesc, whichaccount, dateadded, createdby, currency, userid, transactiondate, tfrom, transactionref, cashref, branch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, $11, $12, now(), $13, $14, $15, $16)`,
        [req.body.accountnumber, 0, debit ? debit : req.body.debit, newReference, req.body.description, req.body.ttype, 'REDIRECTED', transactiondesc, whichaccount, createdBy, req.body.currency, userid, req.body.tfrom, req.body.transactionref ?? '', req.body.cashref ?? '', req.body.branch]
    );
    req.body.transactiondesc += `Debit redirected from ${req.body.accountnumber} to personal account.|`;

    // Check if phone number is provided in the request body
    if (req.body.phone) {
        // Query the user table to find the user with the provided phone number
        const userQuery = `SELECT id, phone FROM sky."User" WHERE phone = $1`;
        const userResult = await client.query(userQuery, [req.body.phone]);

        if (userResult.rowCount > 0) {
            // If user is found, set the personal account number
            // if (req.orgSettings.personal_account_overdrawn) {
            //     const personalAccountQuery = `SELECT SUM(credit) - SUM(debit) as balance FROM sky."transaction" WHERE accountnumber = $1`;
            //     const personalAccountResult = await client.query(personalAccountQuery, [req.body.personalaccountnumber]);
            //     const personalAccountBalance = personalAccountResult.rows[0].balance;
        
            //     if (personalAccountBalance <= 0) {
                    status = 'ACTIVE';
                // }
            }else{
                // If user is not found, set the personal account number to the default excess account
                if ((debit ? debit : req.body.debit) > 0 && req.body.tfrom === 'BANK') {
                    req.body.personalaccountnumber = req.body.accountnumber;
                    req.body.transactiondesc += `Personal account could not be found. Debit transaction from BANK. Debiting account number ${req.body.accountnumber} regardless.|`;
                } else {
                    req.body.personalaccountnumber = req.orgSettings.default_excess_account || '999999999';
                    req.body.transactiondesc += `User with phone number ${req.body.phone} not found. redirected again to company's excess account.|`;
                }

            }
        } else {
            // If user is not found, set the personal account number to the default excess account
            if ((debit ? debit : req.body.debit) > 0 && req.body.tfrom === 'BANK') {
                req.body.personalaccountnumber = req.body.accountnumber;
                req.body.transactiondesc += `Personal account could not be found. Debit transaction from BANK. Debiting account number ${req.body.accountnumber} regardless.|`;
            } else {
                req.body.personalaccountnumber = req.orgSettings.default_excess_account || '999999999';
                req.body.transactiondesc += `User with phone number ${req.body.phone} not found. redirected again to company's excess account.|`;
            }
    // } else {
    //     // If phone number is not provided, set the personal account number to the default excess account
    //     req.body.personalaccountnumber = req.orgSettings.default_excess_account;
    //     req.body.transactiondesc += `Phone number not provided. Personal account could not be found, redirected again to company's excess account.|`;
    }

    if (req.body.status === 'REJECTED') {
        status = 'REJECTED';
    } else if (status === 'ACTIVE') {
        status = 'ACTIVE';
    } else {
        status = 'ACTIVE';
    }

    if(req.body.tfrom === 'BANK'){
        status = "ACTIVE";  
    }
    
    const newPersonalReference = await generateNewReference(client, req.body.personalaccountnumber, req);
    if (!req.body.transactionref) req.body.transactionref = '';
    if (!req.body.cashref) req.body.cashref = '';
    await client.query(
        `INSERT INTO sky."transaction" (accountnumber, credit, debit, reference, description, ttype, status, transactiondesc, whichaccount, dateadded, createdby, currency, userid, transactiondate, valuedate, tfrom, transactionref, cashref, branch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, $11, $12, now(), now(), $13, $14, $15, $16)`,
        [req.body.personalaccountnumber, 0, debit ? debit : req.body.debit, newPersonalReference, req.body.description, req.body.ttype, status, `Debit was to ${req.body.accountnumber}`, req.body.whichaccount, createdBy, req.body.currency, userid, req.body.tfrom, req.body.transactionref ?? '', req.body.cashref ?? '', req.body.branch]
    );
    
};

function calculateWithdrawalLimit(savingsProduct, currentBalance) {
    if (typeof savingsProduct !== 'object' || savingsProduct === null || typeof currentBalance !== 'number') {
        throw new TypeError('Invalid input: savingsProduct must be a non-null object and currentBalance must be a number');
    }

    switch (savingsProduct.withdrawallimittype) {
        case 'PERCENTAGE':
            return currentBalance * (savingsProduct.withdrawallimit / 100);
        case 'AMOUNT':
            return savingsProduct.withdrawallimit;
        default:
            return 0; // Default to 0 if no valid limit type is specified
    }
}

const makePaymentAndCloseAccount = async (client, loanAccountNumber, credit, description, ttype, transactionStatus, loanaccount) => {
    try {
        // Save the transaction
        req.body.whichaccount = 'LOAN'
        await saveTransaction(client, null, {
            accountnumber: loanAccountNumber,
            credit,
            debit: 0,
            reference: await generateNewReference(client, loanAccountNumber, null, null),
            description,
            ttype,
            status: 'ACTIVE',
            transactiondesc: 'Full payment made and loan account closed',
            whichaccount: 'LOAN',
            currency: loanAccount.currency,
            tfrom: req.body.tfrom
        }, null);
        
        // Update the loan account balance to zero
        await client.query(
            `UPDATE sky."loanaccounts" SET dateclosed = now(), closeamount = $1 WHERE accountnumber = $2`,
            [credit, loanaccount.totalamount]
        );

        console.log('Loan account closed successfully');
    } catch (error) {
        console.error('Error closing loan account:', error.stack);
        throw new Error('Error closing loan account');
    }
};



// Example function to generate dates for compulsory deposits
// const generateDates = () => {
//     // Implement logic to generate dates
//     return { lastDate: new Date(), nextDate: new Date() }; // Replace with actual logic
// };

// Export all functions
module.exports = {
    saveFailedTransaction,
    savePendingTransaction,
    saveTransaction,
    calculateCharge,
    calculatePenalty,
    calculateTax,
    generateNewReference,
    handleDebitRedirectToPersonnalAccount,
    sendNotification,
    calculateWithdrawalLimit,
    handleCreditRedirectToPersonnalAccount,
    handleRedirection,
    applyMinimumCreditAmountPenalty,
    makePaymentAndCloseAccount,
    calculateChargedebit,
    applyWithdrawalCharge,
    takeCharges,
    applySavingsCharge,
};
// generateDates, // Uncomment if needed