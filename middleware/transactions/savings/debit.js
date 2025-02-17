const { StatusCodes } = require('http-status-codes');
const { saveFailedTransaction, savePendingTransaction, saveTransaction, generateNewReference, handleDebitRedirectToPersonnalAccount, calculateChargedebit, calculateWithdrawalLimit, applyWithdrawalCharge } = require('../../../utils/transactionHelper.js');
// const transactionhelper = require('../../../utils/transactionHelper.js');
const { activityMiddleware } = require('../../activity');
const path = require('path');



async function savingsDebit(client, req, res, next, accountnumber, debit, description, ttype, transactionStatus, savingsProduct, whichaccount, accountuser){
    const resolveedpath = path.resolve(__dirname, '../../../utils/transactionHelper.js');
    console.log('resolveedpath', resolveedpath)
    if (debit > 0) {
    
        // 9. Debit and Balance Check
        // Query to calculate the current balance by subtracting the sum of debits from the sum of credits for the given account number
        const balanceQuery = `SELECT SUM(credit) - SUM(debit) AS balance FROM sky."transaction" WHERE accountnumber = $1 AND status = 'ACTIVE'`;
        const balanceResult = await client.query(balanceQuery, [accountnumber]);
        const currentBalance = balanceResult.rows[0]?.balance || 0; // Get the current balance or default to 0 if no result

        // Check if the transaction description is not 'CHARGE'
        if (ttype !== 'CHARGE' && ttype !== 'PENALTY') {
            // Check if the debit amount exceeds the withdrawal limit
            // console.log(savingsProduct, currentBalance)
            let withdrawalLimit;
            try {
                withdrawalLimit = await calculateWithdrawalLimit(savingsProduct, currentBalance);
            } catch (error) {
                console.error('Error calculating withdrawal limit:', error);
                req.transactionError = {
                    status: StatusCodes.INTERNAL_SERVER_ERROR,
                    message: 'Error calculating withdrawal limit.',
                    errors: [error.message],
                };
                return next();
            }

            console.log('what id the withdrawal limit', withdrawalLimit)    

            if (!savingsProduct.allowwithdrawal) { 
                const reasonForRejection = 'Withdrawals are not allowed for this savings product';
                if (req.body.tfrom === 'BANK') {
                    await handleDebitRedirectToPersonnalAccount(client, req, res, accountuser, await generateNewReference(client, accountnumber, req, res), reasonForRejection, whichaccount, debit);
                    await client.query('COMMIT');
                    await activityMiddleware(req, req.user.id, 'Transaction redirected due to withdrawals not being allowed for this savings product', 'TRANSACTION');
                    req.transactionError = {
                        status: StatusCodes.EXPECTATION_FAILED,
                        message: 'Transaction redirected due to withdrawals not being allowed for this savings product.',
                        errors: ['Withdrawals are not allowed for this savings product.'],
                    };
                } else if (req.body.tfrom === 'CASH') {
                    await saveFailedTransaction(client, req, res, reasonForRejection, await generateNewReference(client, accountnumber, req, res), whichaccount);
                    await client.query('COMMIT');
                    await activityMiddleware(req, req.user.id, 'Transaction failed due to withdrawals not being allowed for this savings product', 'TRANSACTION');
                    req.transactionError = {
                        status: StatusCodes.EXPECTATION_FAILED,
                        message: 'Transaction failed due to withdrawals not being allowed for this savings product.',
                        errors: ['Withdrawals are not allowed for this savings product.'],
                    };
                }
                return next();
            }

            if (withdrawalLimit > 0 && debit > withdrawalLimit) {
                transactionStatus = 'FAILED'; // Set transaction status to 'FAILED'
                const reasonForRejection = 'Withdrawal limit exceeded'; // Set reason for rejection
                await saveFailedTransaction(client, req, res, reasonForRejection, await generateNewReference(client, accountnumber, req, res), whichaccount); // Save the failed transaction
                await client.query('COMMIT'); // Commit the transaction
                await activityMiddleware(req, req.user.id, 'Transaction failed due to withdrawal limit exceeded', 'TRANSACTION'); // Log activity
                req.transactionError = {
                    status: StatusCodes.EXPECTATION_FAILED,
                    message: 'Transaction failed due to withdrawal limit exceeded.',
                    errors: ['Withdrawal limit exceeded.'],
                };
                return next();
            } 
            // Check if there is a minimum account balance requirement
            if (savingsProduct.minimumaccountbalance > 0) {
                // Check if the current balance after the debit would be less than the minimum account balance
                if (currentBalance - debit < savingsProduct.minimumaccountbalance) {
                    transactionStatus = savingsProduct.allowoverdrawn ? 'PENDING' : 'FAILED'; // Set transaction status based on whether overdrawn is allowed
                    const reasonForPending = 'Insufficient funds or minimum balance exceeded'; // Set reason for pending status
                    await savePendingTransaction(client, accountnumber, 0, debit, await generateNewReference(client, accountnumber, req, res), description, ttype, reasonForPending, 'PENDING', whichaccount, req); // Save the pending transaction
                    await activityMiddleware(req, req.user.id, 'Pending debit transaction saved due to insufficient funds or minimum balance exceeded', 'TRANSACTION'); // Log activity
                    return next();
                }
            }
            if (savingsProduct.withdrawalcontrol) {
                const { startDate, endDate } = getTransactionPeriod(savingsProduct.withdrawalcontrolwindow, new Date());
                const today = new Date();
                const isWithinPeriod = today >= new Date(startDate) && today <= new Date(endDate);

                if (isWithinPeriod) {
                    // Check if there is a withdrawal charge applicable
            if (req.savingsproduct.withdrawalcharges > 0) {
                await applyWithdrawalCharge(client, req, res, accountnumber, debit, whichaccount);
            }
                    const transactionParams = {
                        accountnumber: accountnumber,
                        debit: debit,
                        reference: await generateNewReference(client, accountnumber, req, res),
                        description: description,
                        ttype: ttype,
                        status: 'ACTIVE',
                        whichaccount: whichaccount
                    };
                    await saveTransaction(client, res, transactionParams, req); // Save the transaction
                    await client.query('COMMIT'); // Commit the transaction
                    return next(); // Go to next
                } else {
                    if (req.body.tfrom === 'CASH') {
                        transactionStatus = 'FAILED';
                        const reasonForRejection = 'Withdrawal not allowed outside control window for cash transactions';
                        await saveFailedTransaction(client, req, res, reasonForRejection, await generateNewReference(client, accountnumber, req, res), whichaccount);
                        await client.query('COMMIT');
                        await activityMiddleware(req, req.user.id, 'Transaction failed due to withdrawal control window restriction for cash transactions', 'TRANSACTION');
                        req.transactionError = {
                            status: StatusCodes.EXPECTATION_FAILED,
                            message: 'Transaction failed due to withdrawal control window restriction for cash transactions.',
                            errors: ['Withdrawal not allowed outside control window for cash transactions.'],
                        };
                        return next();
                    } else if (req.body.tfrom === 'BANK') {
                        const reasonForRejection = 'Withdrawal not allowed outside control window for bank transactions';
                        await handleDebitRedirectToPersonnalAccount(client, req, res, accountuser, await generateNewReference(client, accountnumber, req, res), reasonForRejection, whichaccount, debit);
                        await client.query('COMMIT');
                        await activityMiddleware(req, req.user.id, 'Transaction redirected due to withdrawal control window restriction for bank transactions', 'TRANSACTION');
                        req.transactionError = {
                            status: StatusCodes.MISDIRECTED_REQUEST,
                            message: 'Transaction redirected due to withdrawal control window restriction for bank transactions.',
                            errors: ['Withdrawal not allowed outside control window for bank transactions.'],
                        };
                        // // Collect debit charge if applicable
                        // if (savingsProduct.withdrawalcharges > 0) {
                        //     await applyWithdrawalCharge(client, req, res, accountnumber, debit, whichaccount);
                        // }
                        return next();
                    }
                }
            }
            // Check if there is a withdrawal charge applicable
            if (savingsProduct.withdrawalcharges > 0) {
                await applyWithdrawalCharge(client, req, res, accountnumber, debit, whichaccount);
            }
            // Debit transaction logic
            const transactionParams = {
                accountnumber: accountnumber,
                debit: debit,
                reference: await generateNewReference(client, accountnumber, req, res),
                description: description,
                ttype: ttype,
                status: transactionStatus,
                valuedate: new Date(), // Set the value date to now when transaction becomes active
                whichaccount: whichaccount
            };
            await saveTransaction(client, res, transactionParams, req);
            await activityMiddleware(req, req.user.id, 'Debit transaction saved successfully', 'TRANSACTION'); // Log activity
            return next();
        }
        
        // Debit transaction logic
        const transactionParams = {
            accountnumber: accountnumber,
            debit: debit,
            reference: await generateNewReference(client, accountnumber, req, res),
            description: description,
            ttype: ttype,
            status: transactionStatus,
            valuedate: new Date(), // Set the value date to now when transaction becomes active
            whichaccount: whichaccount
        };
        await saveTransaction(client, res, transactionParams, req);
        await activityMiddleware(req, req.user.id, 'Debit transaction saved successfully', 'TRANSACTION'); // Log activity
        return next();
        
        // const debitTransaction = debitTransactionResult.rows[0];

        // // Handle notifications and tax for debit transaction
        // if (debitTransaction.status === 'ACTIVE') {
        //     const taxAmount = calculateTax(debitTransaction);
        //     await client.query(
        //         `UPDATE sky."transaction" SET tax = $1 WHERE reference = $2`,
        //         [taxAmount, transactionReference]
        //     );
        //     await sendNotification(account.user, debitTransaction); // Assume this function exists
        // }
    }
};

module.exports = {
    savingsDebit
};
