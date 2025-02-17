const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { generateNextDates, validateCode } = require("../../../utils/datecode");

const createPropertyAccount = async (req, res) => {
    let { accountnumber, productid, userid, registrationcharge, registrationdate, registrationpoint, accountofficer, rowsize, repaymentfrequency, numberofrepayments, percentagedelivery, member } = req.body;

    try {
        if (accountnumber) {
            const accountCheckQuery = {
                text: `SELECT * FROM sky."propertyaccount" WHERE accountnumber = $1`,
                values: [accountnumber]
            };
            const { rows: accountCheckRows } = await pg.query(accountCheckQuery);
            if (accountCheckRows.length === 0) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Account number does not exist",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }
        // Check if product exists
        const productQuery = {
            text: `SELECT * FROM sky."propertyproduct" WHERE id = $1`,
            values: [productid]
        };
        const { rows: productRows } = await pg.query(productQuery);
        if (productRows.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Product does not exist",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: [] 
            }); 
        }

        if(!accountnumber){
            // Check user's existing accounts for the product
            const memberAccountQuery = {
                text: `SELECT COUNT(*) FROM sky."propertyaccount" WHERE member = $1 AND productid = $2 AND status = 'ACTIVE'`,
                values: [member, productid]
            };
            const { rows: memberAccountRows } = await pg.query(memberAccountQuery);
            const memberAccountCount = parseInt(memberAccountRows[0].count, 10);

            // Check if the member has reached the maximum number of accounts for the product
            const productMemberAccountLimit = productRows[0].useraccount;
            if (memberAccountCount >= productMemberAccountLimit) {
                return res.status(StatusCodes.BAD_REQUEST).json({  
                    status: false,
                    message: "Maximum number of accounts for this product reached for the member",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }

        // Check if registration point exists
        const registrationPointQuery = {
            text: `SELECT * FROM sky."Registrationpoint" WHERE id = $1`,
            values: [registrationpoint]
        };
        const { rows: registrationPointRows } = await pg.query(registrationPointQuery);
        if (registrationPointRows.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Registration point does not exist",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Check if account officer is not a member
        const accountOfficerQuery = {
            text: `SELECT * FROM sky."User" WHERE id = $1 AND role != 'member'`,
            values: [accountofficer]
        };
        const { rows: accountOfficerRows } = await pg.query(accountOfficerQuery);
        if (accountOfficerRows.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Account officer is not valid",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        if(repaymentfrequency){
            if(!validateCode(repaymentfrequency)){
                return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Invalid repayment frequency",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
            }
        }else{
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Repayment frequency is required",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        await pg.query('BEGIN');

        if (accountnumber) {
            // If accountnumber is provided, update the existing property account
            const updateAccountQuery = {
                text: `UPDATE sky."propertyaccount" SET productid = $1, registrationcharge = $2, registrationdate = $3, registrationpoint = $4, accountofficer = $5, createdby = $6, repaymentfrequency = $7, numberofrepayments = $8, percentagedelivery = $9, status = 'ACTIVE', dateadded = NOW() WHERE accountnumber = $10 RETURNING id`,
                values: [productid, registrationcharge, registrationdate, registrationpoint, accountofficer, userid, repaymentfrequency, numberofrepayments, percentagedelivery, accountnumber]
            };
            const { rows: updatedAccountRows } = await pg.query(updateAccountQuery);
            if (updatedAccountRows.length === 0) {
                await pg.query('ROLLBACK');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Account number does not exist",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
            const propertyAccountId = updatedAccountRows[0].id;

            const checkDeliveredItemsQuery = {
                text: `SELECT COUNT(*) FROM sky."propertyitems" WHERE accountnumber = $1 AND status = 'ACTIVE' AND delivered = true`,
                values: [accountnumber]
            };
            const { rows: deliveredItemsRows } = await pg.query(checkDeliveredItemsQuery);
            const deliveredItemsCount = parseInt(deliveredItemsRows[0].count, 10);

            if (deliveredItemsCount > 0) {
                await pg.query('ROLLBACK');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Cannot update account. Some items have already been delivered.",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            // Delete existing items associated with the accountnumber
            const deleteItemsQuery = {
                text: `DELETE FROM sky."propertyitems" WHERE accountnumber = $1`,
                values: [accountnumber]
            };
            await pg.query(deleteItemsQuery);

            // Save items to propertyitems table
            for (let i = 0; i < rowsize; i++) {
                const itemid = req.body[`itemid${i+1}`];
                const qty = req.body[`qty${i+1}`];
                if (!itemid || !qty) {
                    await pg.query('ROLLBACK');
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: `Item ID or quantity missing for item ${i+1}`,
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: []
                    });
                }
                const propertyItemsQuery = {
                    text: `INSERT INTO sky."propertyitems" (accountnumber, itemid, qty, price, userid, createdby, status, dateadded) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW())`,
                    values: [accountnumber, itemid, qty, 0, userid, userid] // Assuming price is 0 as it's not provided
                };
                await pg.query(propertyItemsQuery);
            }

            await activityMiddleware(req, userid, 'Property account updated successfully', 'PROPERTY_ACCOUNT');

            const deleteInstallmentsQuery = {
                text: `DELETE FROM sky."propertyinstallments" WHERE accountnumber = $1 AND status = 'ACTIVE'`,
                values: [accountnumber]
            };
            await pg.query(deleteInstallmentsQuery);

            // await pg.query('COMMIT');
            // return res.status(StatusCodes.OK).json({ 
            //     status: true, 
            //     message: "Property account updated successfully",
            //     statuscode: StatusCodes.OK,
            //     data: { accountnumber, propertyAccountId },
            //     errors: []
            // });
        } else {
            // Generate a 10-digit account number
            const orgSettingsQuery = `SELECT * FROM sky."Organisationsettings" LIMIT 1`;
            const orgSettingsResult = await pg.query(orgSettingsQuery);

            if (orgSettingsResult.rowCount === 0) {
                await activityMiddleware(req, userid, 'Organisation settings not found', 'PROPERTY_ACCOUNT');
                await pg.query('ROLLBACK');
                throw new Error('Organisation settings not found.');
            }

            const orgSettings = orgSettingsResult.rows[0];
            const accountNumberPrefix = orgSettings.property_account_prefix;

            if (!accountNumberPrefix) {
                await activityMiddleware(req, userid, 'Account number prefix not found in organisation settings', 'PROPERTY_ACCOUNT');
                await pg.query('ROLLBACK');
                throw new Error('Property account prefix not set in organisation settings.');
            }

            const accountRowsQuery = `SELECT accountnumber FROM sky."propertyaccount" WHERE accountnumber::text LIKE $1 ORDER BY accountnumber DESC LIMIT 1`;
            const { rows: accountRows } = await pg.query(accountRowsQuery, [`${accountNumberPrefix}%`]);

            if (accountRows.length === 0) {
                accountnumber = `${accountNumberPrefix}${'0'.repeat(10 - accountNumberPrefix.toString().length - 1)}1`;
            } else {
                const highestAccountNumber = accountRows[0].accountnumber;
                const newAccountNumber = parseInt(highestAccountNumber) + 1;
                const newAccountNumberStr = newAccountNumber.toString();

                if (newAccountNumberStr.startsWith(accountNumberPrefix)) {
                    accountnumber = newAccountNumberStr.padStart(10, '0');
                } else {
                    await activityMiddleware(req, userid, `More accounts cannot be opened with the prefix ${accountNumberPrefix}. Please update the prefix to start a new account run.`, 'PROPERTY_ACCOUNT');
                    await pg.query('ROLLBACK');
                    throw new Error(`More accounts cannot be opened with the prefix ${accountNumberPrefix}. Please update the prefix to start a new account run.`);
                }
            }

            // Save to propertyaccount table
            const propertyAccountQuery = {
                text: `INSERT INTO sky."propertyaccount" (productid, accountnumber, userid, member, registrationcharge, registrationdate, registrationpoint, accountofficer, createdby, repaymentfrequency, numberofrepayments, percentagedelivery, status, dateadded) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE', NOW()) RETURNING id`,
                values: [productid, accountnumber, userid, member, registrationcharge, registrationdate, registrationpoint, accountofficer, userid, repaymentfrequency, numberofrepayments, percentagedelivery]
            };
            const { rows: propertyAccountRows } = await pg.query(propertyAccountQuery);
            const propertyAccountId = propertyAccountRows[0].id;

            // Save items to propertyitems table
            for (let i = 0; i < rowsize; i++) {
                const itemid = req.body[`itemid${i+1}`];
                const qty = req.body[`qty${i+1}`];
                const propertyItemsQuery = {
                    text: `INSERT INTO sky."propertyitems" (accountnumber, itemid, qty, price, userid, createdby, status, dateadded) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW())`,
                    values: [accountnumber, itemid, qty, 0, userid, userid] // Assuming price is 0 as it's not provided
                };
                await pg.query(propertyItemsQuery);
            }

            await activityMiddleware(req, userid, 'Property account created successfully', 'PROPERTY_ACCOUNT');
            // await pg.query('COMMIT');

            // return res.status(StatusCodes.CREATED).json({
            //     status: true,
            //     message: "Property account created successfully",
            //     statuscode: StatusCodes.CREATED,
            //     data: { accountnumber, propertyAccountId },
            //     errors: []
            // });
        }

        const dates = await generateNextDates(repaymentfrequency, numberofrepayments);
        // console.log('dates', dates); 
        // await pg.query('ROLLBACK');
        // return res.status(StatusCodes.OK).json({ 
        //     dates
        // });
        let totalValue = 0;
        let itemDetails = [];

        // Calculate total value and store item details
        for (let i = 0; i < Number(rowsize); i++) {
            const itemid = req.body[`itemid${i + 1}`];
            const qty = req.body[`qty${i + 1}`];
            const price = req.body[`price${i + 1}`] || 0;

            console.log(`Processing item ${i + 1}: itemid=${itemid}, qty=${qty}, price=${price}`);

            if (itemid && qty) {
                const itemTotalValue = qty * price;
                totalValue += itemTotalValue;

                console.log(`Item ${i + 1} total value: ${itemTotalValue}, cumulative total value: ${totalValue}`);

                // Store item-specific details for further processing
                itemDetails.push({
                    itemid,
                    qty,
                    price,
                    totalValue: itemTotalValue,
                    percentageThreshold: (itemTotalValue * percentagedelivery) / 100, // Percentage delivery threshold for this item
                    cumulativePaid: 0, // Tracks amount paid toward this item
                    released: false // Tracks if the item has been released
                });
            }
        }

        // Calculate amount per installment
        const amountPerInstallment = totalValue / dates.length;
        console.log(`Amount per installment: ${amountPerInstallment}`);

        // Save installments and determine which items can be released
        for (let i = 0; i < dates.length; i++) {
            let installmentDescription = ''; 
            let amountRemaining = amountPerInstallment;

            console.log(`Processing installment ${i + 1}: due date=${dates[i]}, initial amount remaining=${amountRemaining}`);

            // Iterate over itemDetails to allocate the installment amount
            for (let item of itemDetails) {
                if (item.released) continue; // Skip already released items

                // Add installment amount toward the item's cumulative paid amount
                const amountTowardItem = Math.min(amountRemaining, item.totalValue - item.cumulativePaid);
                item.cumulativePaid += amountTowardItem;
                amountRemaining -= amountTowardItem;

                console.log(`Allocating ${amountTowardItem} to itemid ${item.itemid}, cumulative paid: ${item.cumulativePaid}, amount remaining: ${amountRemaining}`);

                // Check if the item's cumulative paid amount meets or exceeds its percentage threshold
                if (!item.released && item.cumulativePaid >= item.percentageThreshold) {
                    item.released = true;
                    installmentDescription += `Release item with itemid ${item.itemid} to the customer.\n`;
                    console.log(`Itemid ${item.itemid} released to customer.`);
                }

                if (amountRemaining <= 0) break; // Stop allocation if the installment amount is fully utilized
            }

            // Save the installment with the appropriate description
            const propertyInstallmentsQuery = {
                text: `INSERT INTO sky."propertyinstallments" (accountnumber, amount, duedate, delivered, userid, description, createdby, status, dateadded) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW())`,
                values: [
                    accountnumber,
                    amountPerInstallment,
                    dates[i],
                    false,
                    userid,
                    installmentDescription.trim(),
                    userid
                ]
            };
            console.log(`Saving installment ${i + 1} with description: ${installmentDescription.trim()}`);
            const { rowCount } = await pg.query(propertyInstallmentsQuery);
            if (rowCount === 0) {
                await pg.query('ROLLBACK');
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                    status: false,
                    message: "Failed to save installment",
                    statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                    data: null,
                    errors: []
                });
            }
        }

        await pg.query('COMMIT');
            return res.status(StatusCodes.OK).json({ 
                status: true, 
                message: accountnumber ? "Property account updated successfully" : "Property account created successfully",
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            }); 


 
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, userid, 'An unexpected error occurred creating property account', 'PROPERTY_ACCOUNT');
        await pg.query('ROLLBACK');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { createPropertyAccount };
