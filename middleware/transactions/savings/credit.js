const { StatusCodes } = require('http-status-codes');
const { saveFailedTransaction, savePendingTransaction, handleCreditRedirectToPersonalAccount, calculateCharge, generateNewReference, handleCreditRedirectToPersonnalAccount, saveTransaction, applyMinimumCreditAmountPenalty, applySavingsCharge } = require('../../../utils/transactionHelper');
const { activityMiddleware } = require('../../activity');
const { getTransactionPeriod, generateNextDates } = require('../../../utils/datecode');




async function savingsCredit(client, req, res, next, accountnumber, credit, description, ttype, transactionStatus, savingsProduct, whichaccount, accountuser){
    console.log("Entered savingsCredit function with credit:", credit);
    if (credit > 0) { 

        // apply check for minimum credit and penalty
        await applyMinimumCreditAmountPenalty(client, req, res, req.orgSettings);


        // 8. Handle Deposit Charge
        if (credit > 0 && savingsProduct.depositcharge) {
            console.log("Handling deposit charge for credit:", credit);
            await applySavingsCharge(client, req, res, accountnumber, credit, whichaccount);
        }
        console.log('it left the charge area')
        // 7. Savings Product Rules - Allow Deposit
        if (credit > 0 && !savingsProduct.allowdeposit) {
            console.log("Deposits not allowed on this product, redirecting transaction.");
            transactionStatus = 'REDIRECTED';
            reasonForRejection = 'Deposits not allowed on this product';
            // Handle redirection to excess account logic
            await handleCreditRedirectToPersonnalAccount(client, req, res, accountuser, generateNewReference(client, accountnumber, req, res), reasonForRejection, whichaccount);
            await client.query('COMMIT'); // Commit the transaction
            await activityMiddleware(req, req.user.id, 'Transaction committed after deposit not allowed', 'TRANSACTION');
            req.transactionError = {
                status: StatusCodes.MISDIRECTED_REQUEST,
                message: 'Transaction has been redirected to the personal account because the savings account is restricted from taking deposits.',
                errors: ['Deposits not allowed on this product. Transaction redirected to personal account.']
            };
            req.body.transactiondesc += 'Deposits not allowed on this product.|';
            return next();
        }

        //  // 7. Savings Product Rules - Allow Deposit
        //  if (credit > 0 && !savingsProduct.allowdeposit) {
        //     console.log("Deposits not allowed on this product, redirecting transaction.");
        //     transactionStatus = 'REDIRECTED';
        //     reasonForRejection = 'Deposits not allowed on this product';
        //     // Handle redirection to excess account logic
        //     await handleCreditRedirectToPersonnalAccount(client, req, res, accountuser, await generateNewReference(client, accountnumber, req, res), reasonForRejection, whichaccount);
        //     await client.query('COMMIT'); // Commit the transaction
        //     await activityMiddleware(req, req.user.id, 'Transaction committed after deposit not allowed', 'TRANSACTION');
        //     req.transactionError = {
        //         status: StatusCodes.MISDIRECTED_REQUEST,
        //         message: 'Transaction has been redirected to the personal account because the savings account is restricted from taking deposits.',
        //         errors: ['Deposits not allowed on this product. Transaction redirected to personal account.']
        //     };
        //     req.body.transactiondesc += 'Deposits not allowed on this product.|';
        //     return next();
        // }

        // **9. Check Max Balance Limit (Added this block)**
        if (credit > 0 && savingsProduct.maxbalance) {
            console.log("Checking max balance limit.");
            // Get the current balance
            const balanceQuery = `
                SELECT COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) AS balance
                FROM skyeu."transaction"
                WHERE accountnumber = $1 AND status = 'ACTIVE'
            `;
            const balanceResult = await client.query(balanceQuery, [accountnumber]);
            const currentBalance = parseFloat(balanceResult.rows[0].balance);
            console.log("Current balance:", currentBalance);
            // Check if adding the credit would reach or exceed maxbalance
            if (currentBalance + credit >= savingsProduct.maxbalance) {
                console.log("Max balance reached or exceeded. Redirecting to personal account.");
                transactionStatus = 'REDIRECTED';
                const reasonForRejection = 'Max balance reached or exceeded';
                await handleCreditRedirectToPersonnalAccount(
                    client,
                    req,
                    res,
                    accountuser,
                    await generateNewReference(client, accountnumber, req, res),
                    reasonForRejection,
                    whichaccount,
                    credit // Amount to redirect
                );
                await client.query('COMMIT'); // Commit the transaction
                await activityMiddleware(
                    req,
                    req.user.id,
                    'Transaction committed after max balance reached or exceeded',
                    'TRANSACTION'
                );
                req.transactionError = {
                    status: StatusCodes.MISDIRECTED_REQUEST,
                    message: 'Transaction has been redirected to the personal account because the savings account has reached its maximum balance limit.',
                    errors: ['Max balance reached or exceeded. Transaction redirected to personal account.']
                };
                req.body.transactiondesc += 'Max balance reached or exceeded.|';
                return next();
            }
        }

        // 10. Compulsory Deposit Logic
        if (savingsProduct.compulsorydeposit) {
            console.log("Handling compulsory deposit logic.");
        
            // Check if credit is less than the compulsory deposit amount
            if (credit < savingsProduct.compulsorydepositfrequencyamount) {
                console.log("Credit amount is less than compulsory deposit amount.");
                transactionStatus = 'FAILED';
                reasonForRejection = 'Credit amount is less than compulsory deposit amount';
                 await handleCreditRedirectToPersonnalAccount(
                    client,
                    req,
                    res,
                    accountuser, 
                    generateNewReference(client, accountnumber, req, res),
                    reasonForRejection,
                    whichaccount
                );
                await client.query('COMMIT'); // Commit the transaction
                await activityMiddleware(
                    req,
                    req.user.id,
                    'Transaction committed after compulsory deposit amount not met',
                    'TRANSACTION'
                );
                req.transactionError = {
                    status: StatusCodes.EXPECTATION_FAILED,
                    message: 'Credit amount is less than compulsory deposit amount.',
                    errors: ['Credit amount is less than compulsory deposit amount.']
                };
                req.body.transactiondesc += 'Credit amount is less than compulsory deposit amount.|';
                return next();
            }
        
            // Calculate the remainder
            const remainder = credit % savingsProduct.compulsorydepositfrequencyamount;
            console.log("Calculated remainder for compulsory deposit:", remainder);
        
            // Get the last transaction on the account
            const lastTransactionQuery = `
                SELECT * FROM skyeu."transaction"
                WHERE accountnumber = $1 AND status = 'ACTIVE'
                ORDER BY transactiondate DESC
                LIMIT 1
            `;
            const lastTransactionResult = await client.query(lastTransactionQuery, [accountnumber]);
            let lastTransactionDate = new Date();
        
            // If there is a previous transaction, set the lastTransactionDate to the date of that transaction
            if (lastTransactionResult.rowCount > 0) {
                lastTransactionDate = new Date(lastTransactionResult.rows[0].transactiondate);
                console.log("Last transaction date:", lastTransactionDate);
            }
        
            // Get the transaction period based on the compulsory deposit frequency and the last transaction date
            const { startDate, endDate } = getTransactionPeriod(savingsProduct.compulsorydepositfrequency, lastTransactionDate);
            console.log("Transaction period from", startDate, "to", endDate);
        
            // Check if today's date falls within the calculated transaction period
            const today = new Date();
            const isWithinPeriod = today >= new Date(startDate) && today <= new Date(endDate);
            console.log("Is today within the transaction period?", isWithinPeriod);
        
            const multipleOfFrequency = Math.floor(credit / savingsProduct.compulsorydepositfrequencyamount);
            console.log("Multiple of frequency amount:", multipleOfFrequency);
        
            // Generate all relevant dates based on the frequency
            const dates = generateNextDates(savingsProduct.compulsorydepositfrequency, multipleOfFrequency, endDate);
            console.log("All calculated dates:", dates);
        
            // Separate past and future dates
            const pastDates = dates.filter(date => new Date(date) < today);
            const futureDates = dates.filter(date => new Date(date) >= today);
            console.log("Past dates:", pastDates, "Future dates:", futureDates);
        
            // Initialize remaining balance
            let remainingBalance = credit;
        
            if (savingsProduct.compulsorydeposittype === 'FIXED') {
                console.log("Handling FIXED compulsory deposit type.");
        
                // Distribute deposits to all dates
                for (const date of dates) {
                    if (remainingBalance >= savingsProduct.compulsorydepositfrequencyamount) {
                        const transactionData = {
                            accountnumber: accountnumber,
                            credit: savingsProduct.compulsorydepositfrequencyamount,
                            reference: generateNewReference(client, accountnumber, req, res),
                            description: description,
                            ttype: ttype,
                            status: 'ACTIVE',
                            transactiondate: date,
                            whichaccount
                        };
                        await saveTransaction(client, res, transactionData, req);
                        await activityMiddleware(req.user.id, 'Transaction saved for FIXED type', 'TRANSACTION');
                        remainingBalance -= savingsProduct.compulsorydepositfrequencyamount;
                    } else {
                        break; // No more funds to allocate
                    }
                }
        
                console.log("Remaining balance after FIXED deposits:", remainingBalance);
        
                // Redirect any remaining balance to personal account
                if (remainingBalance > 0) {
                    console.log("Redirecting remaining balance to personal account.");
                    transactionStatus = 'REDIRECTED';
                    reasonForRejection = 'Remaining balance redirected to personal account';
                    await handleCreditRedirectToPersonnalAccount(
                        client,
                        req,
                        res,
                        accountuser,
                        generateNewReference(client, accountnumber, req, res),
                        reasonForRejection,
                        whichaccount,
                        remainingBalance
                    );
                    await client.query('COMMIT'); // Commit the transaction
                    await activityMiddleware(
                        req,
                        req.user.id,
                        'Transaction committed after redirecting remaining balance (FIXED)',
                        'TRANSACTION'
                    );
                    req.transactionError = {
                        status: StatusCodes.MISDIRECTED_REQUEST,
                        message: 'Remaining balance redirected to personal account.',
                        errors: ['Remaining balance redirected to personal account.']
                    };
                    req.body.transactiondesc += 'Remaining balance redirected to personal account.|';
                    return next();
                }
        
            } else if (savingsProduct.compulsorydeposittype === 'MINIMUM') {
                console.log("Handling MINIMUM compulsory deposit type.");
        
                // Distribute deposits to past dates first
                for (const date of pastDates) {
                    if (remainingBalance >= savingsProduct.compulsorydepositfrequencyamount) {
                        const transactionData = {
                            accountnumber: accountnumber,
                            credit: savingsProduct.compulsorydepositfrequencyamount,
                            reference: generateNewReference(client, accountnumber, req, res),
                            description: description,
                            ttype: ttype,
                            status: 'ACTIVE',
                            transactiondate: date,
                            whichaccount
                        };
                        await saveTransaction(client, res, transactionData, req);
                        await activityMiddleware(req.user.id, 'Transaction saved for past date (MINIMUM)', 'TRANSACTION');
                        remainingBalance -= savingsProduct.compulsorydepositfrequencyamount;
                    } else {
                        console.log(`Insufficient balance for past date deposit on ${date}. Redirecting remaining balance.`);
                        // Redirect the remaining balance to personal account
                        transactionStatus = 'REDIRECTED';
                        reasonForRejection = 'Remaining balance redirected to personal account';
                        await handleCreditRedirectToPersonnalAccount(
                            client,
                            req,
                            res,
                            accountuser,
                            generateNewReference(client, accountnumber, req, res),
                            reasonForRejection,
                            whichaccount,
                            remainingBalance
                        );
                        await client.query('COMMIT'); // Commit the transaction
                        await activityMiddleware(
                            req,
                            req.user.id,
                            `Transaction committed after insufficient balance for past date deposit on ${date} (MINIMUM)`,
                            'TRANSACTION'
                        );
                        req.transactionError = {
                            status: StatusCodes.MISDIRECTED_REQUEST,
                            message: 'Remaining balance redirected to personal account.',
                            errors: ['Remaining balance redirected to personal account.']
                        };
                        req.body.transactiondesc += 'Remaining balance redirected to personal account.|';
                        return next();
                    }
                }
        
                console.log("Remaining balance after past deposits:", remainingBalance);
        
                // If there is remaining balance, handle current/future dates
                if (remainingBalance > 0) {
                    console.log("Processing first future date for MINIMUM deposit.");
        
                    // Find the first future date
                    if (futureDates.length > 0) {
                        const firstFutureDate = futureDates[0];
                        console.log(`First future date: ${firstFutureDate}`);
        
                        if (remainingBalance >= savingsProduct.compulsorydepositfrequencyamount) {
                            // Deposit all remaining balance to the first future date
                            const transactionData = {
                                accountnumber: accountnumber,
                                credit: remainingBalance, // Deposit entire remaining balance
                                reference: generateNewReference(client, accountnumber, req, res),
                                description: description,
                                ttype: ttype,
                                status: 'ACTIVE',
                                transactiondate: firstFutureDate,
                                whichaccount
                            };
                            await saveTransaction(client, res, transactionData, req);
                            await activityMiddleware(req.user.id, 'Transaction saved for first future date (MINIMUM)', 'TRANSACTION');
                            remainingBalance = 0; // All funds allocated
                        } else {
                            // Remaining balance is less than frequency amount; redirect to personal account
                            console.log("Remaining balance less than frequency amount. Redirecting to personal account.");
                            transactionStatus = 'REDIRECTED';
                            reasonForRejection = 'Remaining balance redirected to personal account';
                            await handleCreditRedirectToPersonnalAccount(
                                client,
                                req,
                                res,
                                accountuser,
                                generateNewReference(client, accountnumber, req, res),
                                reasonForRejection,
                                whichaccount,
                                remainingBalance
                            );
                            await client.query('COMMIT'); // Commit the transaction
                            await activityMiddleware(
                                req,
                                req.user.id,
                                'Transaction committed after redirecting remaining balance (MINIMUM)',
                                'TRANSACTION'
                            );
                            req.transactionError = {
                                status: StatusCodes.MISDIRECTED_REQUEST,
                                message: 'Remaining balance redirected to personal account.',
                                errors: ['Remaining balance redirected to personal account.']
                            };
                            req.body.transactiondesc += 'Remaining balance redirected to personal account.|';
                            return next();
                        }
                    } else {
                        // No future dates available; redirect remaining balance
                        console.log("No future dates available. Redirecting remaining balance to personal account.");
                        transactionStatus = 'REDIRECTED';
                        reasonForRejection = 'Remaining balance redirected to personal account';
                        await handleCreditRedirectToPersonnalAccount(
                            client,
                            req,
                            res,
                            accountuser,
                            generateNewReference(client, accountnumber, req, res),
                            reasonForRejection,
                            whichaccount,
                            remainingBalance
                        );
                        await client.query('COMMIT'); // Commit the transaction
                        await activityMiddleware(
                            req,
                            req.user.id,
                            'Transaction committed after no future dates available (MINIMUM)',
                            'TRANSACTION'
                        );
                        req.transactionError = {
                            status: StatusCodes.MISDIRECTED_REQUEST,
                            message: 'Remaining balance redirected to personal account.',
                            errors: ['Remaining balance redirected to personal account.']
                        };
                        req.body.transactiondesc += 'Remaining balance redirected to personal account.|';
                        return next();
                    }
                }
        
            } else {
                // Handle other deposit types if necessary
                console.log("Unhandled compulsory deposit type:", savingsProduct.compulsorydeposittype);
                // You might want to handle other types or throw an error
            }
        
            // Commit the transaction if all deposits are handled successfully
            await client.query('COMMIT');
            await activityMiddleware(req.user.id, 'All compulsory deposits handled successfully', 'TRANSACTION');
        
            // Optionally, set a success response or proceed further
            // For example:
            // req.body.transactiondesc += 'All compulsory deposits handled successfully.|';
            // return next();
        }

        transactionStatus = 'ACTIVE';

        console.log('its saving without a problem')
        await saveTransaction(client, res, {
            accountnumber,
            credit,
            reference: await generateNewReference(client, accountnumber, req, res),
            description,
            ttype,
            status: transactionStatus,
            whichaccount
        }, req);
        
        // return next();
        
        


        // Credit transaction logic
        // const creditTransactionInsertQuery = `
        //     INSERT INTO skyeu."transaction" (accountnumber, credit, reference, description, ttype, status, valuedate, whichaccount) 
        //     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
        // const creditTransactionResult = await client.query(creditTransactionInsertQuery, [
        //     accountnumber,
        //     credit,
        //     transactionReference,
        //     description,
        //     ttype,
        //     transactionStatus,
        //     new Date(), // Set the value date to now when transaction becomes active
        //     whichaccount
        // ]);
        // return next();

        //  // 8. Handle Deposit Charge
        //  if (credit > 0 && savingsProduct.depositcharge) {
        //     const chargeAmount = calculateCharge(savingsProduct, credit);
        //     await client.query(
        //         `INSERT INTO skyeu."transaction" (accountnumber, debit, description, reference, status, whichaccount) VALUES ($1, $2, $3, $4, 'PENDING', $5)`,
        //         [accountnumber, chargeAmount, 'Deposit Charge', generateNewReference(client, accountnumber, req, res), whichaccount]
        //     );
        // }


        // const creditTransaction = creditTransactionResult.rows[0];

        // // Handle notifications and tax for credit transaction
        // if (creditTransaction.status === 'ACTIVE') {
        //     const taxAmount = calculateTax(creditTransaction);
        //     await client.query(
        //         `UPDATE skyeu."transaction" SET tax = $1 WHERE reference = $2`,
        //         [taxAmount, transactionReference]
        //     );
        //     await sendNotification(account.user, creditTransaction); // Assume this function exists
        // }
    }
};

// 11. Export the savingsCredit function
module.exports = {
    savingsCredit
};
