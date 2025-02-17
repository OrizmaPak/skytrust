    const { StatusCodes } = require("http-status-codes");
    const pg = require("../../../db/pg");
    const { activityMiddleware } = require("../../../middleware/activity");
    const { validateCode, generateNextDates } = require("../../../utils/datecode");

    const createOrUpdateRotaryAccount = async (req, res) => {
        const user = req.user;
        const { accountnumber, productid, amount, frequency, frequencynumber, autorunnew, userid, member, branch, registrationcharge, registrationpoint, registrationdesc } = req.body;

        console.log("Received request to create or update rotary account:", req.body);

        // Basic validation to ensure required fields are present
        if (!productid || !amount || !userid || !member) {
            console.log("Validation failed: Missing required fields");
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Missing required fields",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: [
                    { field: 'productid', message: 'Product ID is required' },
                    { field: 'amount', message: 'Amount is required' },
                    { field: 'userid', message: 'User ID is required' },
                    { field: 'member', message: 'Member is required' }
                ]
            });
        }

        // Check if the product ID exists in the rotaryProduct table
        console.log("Checking if product ID exists in rotaryProduct table");
        const productQuery = `SELECT * FROM sky."rotaryProduct" WHERE id = $1`;
        const productResult = await pg.query(productQuery, [productid]);

        if (productResult.rowCount === 0) {
            console.log("Product ID not found in rotaryProduct");
            await activityMiddleware(req, user.id, 'Product ID not found in rotaryProduct', 'ROTARY_ACCOUNT');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Product ID not found.",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Product ID not found in rotaryProduct."]
            });
        }

        if (!accountnumber) {
            const userAccount = productResult.rows[0].useraccount;
            console.log("User account number from product:", userAccount);

            // Check the number of rotary accounts for the given userid, productid, and member
            console.log("Checking number of rotary accounts for user, product, and member");
            const rotaryAccountQuery = `
                SELECT COUNT(*) as count
                FROM sky."rotaryaccount"
                WHERE userid = $1 AND productid = $2 AND member = $3
            `;
            const { rows: [{ count }] } = await pg.query(rotaryAccountQuery, [userid, productid, member]);
            console.log("Current count of rotary accounts:", count);

            if (count >= userAccount) {
                console.log("Exceeded minimum allowed opened accounts");
                await activityMiddleware(req, user.id, 'Exceeded minimum allowed opened accounts', 'ROTARY_ACCOUNT');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "You have reached the minimum allowed opened accounts.",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["Exceeded the minimum allowed opened accounts."]
                });
            }
        }

        // Validate the frequency code
        console.log("Validating frequency code:", frequency);
        if (!validateCode(frequency)) {
            console.log("Invalid frequency provided");
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Invalid frequency provided.",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["Frequency not understood."]
            });
        }

        console.log('frequency', productResult.rows[0].rotaryschedule);

        // Determine the frequency and frequency number based on the product's rotary schedule
        let thefrequency = frequency;
        let thefrequencynumber = frequencynumber;

        if (productResult.rows[0].rotaryschedule == 'ACCOUNT') {
            console.log("Rotary schedule is ACCOUNT, using provided frequency and frequency number");
            thefrequency = frequency;
            thefrequencynumber = frequencynumber;
        } else if (productResult.rows[0].rotaryschedule == 'PRODUCT') {
            console.log("Rotary schedule is PRODUCT, using product's frequency and frequency number");
            thefrequency = productResult.rows[0].frequency;
            thefrequencynumber = productResult.rows[0].frequencynumber;
        }

        try {
            // Fetch the organisation settings to get the account number prefix
            console.log("Fetching organisation settings for account number prefix");
            const orgSettingsQuery = `SELECT * FROM sky."Organisationsettings" LIMIT 1`;
            const orgSettingsResult = await pg.query(orgSettingsQuery);

            if (orgSettingsResult.rowCount === 0) {
                console.log("Organisation settings not found");
                await activityMiddleware(req, user.id, 'Organisation settings not found', 'ROTARY_ACCOUNT');
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                    status: false,
                    message: "Organisation settings not found.",
                    statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                    data: null,
                    errors: ["Organisation settings not found."]
                });
            }

            const orgSettings = orgSettingsResult.rows[0];
            const accountNumberPrefix = orgSettings.rotary_account_prefix;
            console.log("Account number prefix:", accountNumberPrefix);

            if (!accountNumberPrefix) {
                console.log("Account number prefix not found in organisation settings");
                await activityMiddleware(req, user.id, 'Account number prefix not found in organisation settings', 'ROTARY_ACCOUNT');
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                    status: false,
                    message: "Rotary account prefix not set in organisation settings.",
                    statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                    data: null,
                    errors: ["Rotary account prefix not set in organisation settings."]
                });
            }

            let generatedAccountNumber = accountnumber;

            if (!accountnumber) {
                // Generate a new account number if not provided
                console.log("Generating new account number");
                const accountRowsQuery = `SELECT accountnumber FROM sky."rotaryaccount" WHERE accountnumber::text LIKE $1 ORDER BY accountnumber DESC LIMIT 1`;
                const { rows: accountRows } = await pg.query(accountRowsQuery, [`${accountNumberPrefix}%`]);

                if (accountRows.length === 0) {
                    // Generate the first account number with the given prefix 
                    generatedAccountNumber = `${accountNumberPrefix}${'0'.repeat(10 - accountNumberPrefix.toString().length - 1)}1`;
                    console.log("Generated first account number:", generatedAccountNumber);
                } else {
                    // Generate the next account number
                    const highestAccountNumber = accountRows[0].accountnumber;
                    const newAccountNumber = parseInt(highestAccountNumber) + 1;
                    const newAccountNumberStr = newAccountNumber.toString();
                    console.log("Highest account number:", highestAccountNumber, "New account number:", newAccountNumberStr);

                    if (newAccountNumberStr.startsWith(accountNumberPrefix)) {
                        generatedAccountNumber = newAccountNumberStr.padStart(10, '0');
                        console.log("Generated account number:", generatedAccountNumber);
                    } else {
                        console.log(`More accounts cannot be opened with the prefix ${accountNumberPrefix}`);
                        await activityMiddleware(req, user.id, `More accounts cannot be opened with the prefix ${accountNumberPrefix}. Please update the prefix to start a new account run.`, 'ROTARY_ACCOUNT');
                        return res.status(StatusCodes.BAD_REQUEST).json({
                            status: false,
                            message: `More accounts cannot be opened with the prefix ${accountNumberPrefix}. Please update the prefix to start a new account run.`,
                            statuscode: StatusCodes.BAD_REQUEST,
                            data: null,
                            errors: []
                        });
                    }
                }
            }

            let query;
            if (accountnumber) {
                // Update existing rotary account
                console.log("Updating existing rotary account");
                query = {
                    text: `UPDATE sky."rotaryaccount" 
                           SET productid = $1, amount = $2, frequency = $3, frequencynumber = $4, autorunnew = $5, userid = $6, member = $7, branch = $8, registrationcharge = $9, registrationpoint = $10, registrationdesc = $11, dateupdated = NOW() 
                           WHERE accountnumber = $12 RETURNING *`,
                    values: [productid, amount, frequency, frequencynumber, autorunnew, userid, member, branch || 0, registrationcharge || 0, user.registrationpoint || 0, registrationdesc || '', accountnumber]
                };
            } else {
                // Insert new rotary account
                console.log("Inserting new rotary account");
                query = {
                    text: `INSERT INTO sky."rotaryaccount" 
                           (accountnumber, productid, amount, frequency, frequencynumber, autorunnew, userid, member, branch, registrationcharge, registrationpoint, registrationdesc, dateadded, status) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), 'ACTIVE') RETURNING *`,
                    values: [generatedAccountNumber, productid, amount, frequency, frequencynumber, autorunnew, userid, member, branch || 0, registrationcharge || 0, user.registrationpoint || 0, registrationdesc || '']
                };
            }

            const { rows: [account] } = await pg.query(query);
            console.log("Rotary account operation successful:", account);

            // Check the rotaryschedule table for existing schedules with the generated account number
            console.log("Checking rotaryschedule table for existing schedules");
            const scheduleQuery = {
                text: `SELECT * FROM sky."rotaryschedule" WHERE accountnumber = $1 AND currentschedule = 'YES'`,
                values: [generatedAccountNumber]
            };
            const { rows: existingSchedules } = await pg.query(scheduleQuery);
            console.log("Existing schedules found:", existingSchedules.length);

            if (existingSchedules.length > 0) {
                // Current schedule exists, delete them
                console.log("Deleting existing schedules with currentschedule as YES");
                const deleteScheduleQuery = {
                    text: `DELETE FROM sky."rotaryschedule" 
                           WHERE accountnumber = $1 AND currentschedule = 'YES'`,
                    values: [generatedAccountNumber]
                };
                await pg.query(deleteScheduleQuery);
            } 

                // No current schedule exists, generate new dates
                console.log("No existing schedule, generating new dates");
                const nextDates = generateNextDates(thefrequency, thefrequencynumber);
                console.log("Generated next dates:", nextDates);

                // Insert new schedules into the rotaryschedule table
                for (const date of nextDates) {
                    console.log("Inserting new schedule for date:", date);
                    const insertScheduleQuery = {
                        text: `INSERT INTO sky."rotaryschedule" 
                               (accountnumber, amount, duedate, dateadded, currentschedule, status, createdby) 
                               VALUES ($1, $2, $3, NOW(), 'YES', 'ACTIVE', $4)`,
                        values: [generatedAccountNumber, amount, date, user.id]
                    };
                    await pg.query(insertScheduleQuery);
                }

            // Handle poolnumber logic
            const poolNumber = productResult.rows[0].poolnumber;
            if (poolNumber === 'SEQUENCE') {
                console.log("Handling SEQUENCE poolnumber logic");
                const maxScheduleQuery = {
                    text: `SELECT MAX(duedate) as maxduedate FROM sky."rotaryschedule" WHERE accountnumber = $1`,
                    values: [generatedAccountNumber]
                };
                const { rows: [{ maxduedate }] } = await pg.query(maxScheduleQuery);
                const totalAmountQuery = {
                    text: `SELECT SUM(amount) as totalamount FROM sky."rotaryschedule" WHERE accountnumber = $1`,
                    values: [generatedAccountNumber]
                };
                const { rows: [{ totalamount }] } = await pg.query(totalAmountQuery);

                const insertSequenceScheduleQuery = {
                    text: `INSERT INTO sky."rotaryschedule" 
                           (accountnumber, amount, duedate, dateadded, currentschedule, status, createdby, payout) 
                           VALUES ($1, $2, $3, NOW(), 'YES', 'ACTIVE', $4, 'YES')`,
                    values: [generatedAccountNumber, totalamount, maxduedate, user.id]
                }; 
                await pg.query(insertSequenceScheduleQuery);
            } else if (poolNumber === 'RANDOM') {
                console.log("Handling RANDOM poolnumber logic");
                const randomScheduleQuery = {
                    text: `SELECT duedate FROM sky."rotaryschedule" WHERE accountnumber = $1 ORDER BY RANDOM() LIMIT 1`,
                    values: [generatedAccountNumber]
                };
                const { rows: [{ duedate: randomDuedate }] } = await pg.query(randomScheduleQuery);
                const totalAmountQuery = {
                    text: `SELECT SUM(amount) as totalamount FROM sky."rotaryschedule" WHERE accountnumber = $1`,
                    values: [generatedAccountNumber]
                };
                const { rows: [{ totalamount }] } = await pg.query(totalAmountQuery);

                const insertRandomScheduleQuery = {
                    text: `INSERT INTO sky."rotaryschedule" 
                           (accountnumber, amount, duedate, dateadded, currentschedule, status, createdby, payout) 
                           VALUES ($1, $2, $3, NOW(), 'YES', 'ACTIVE', $4, 'YES')`,
                    values: [generatedAccountNumber, totalamount, randomDuedate, user.id]
                };
                await pg.query(insertRandomScheduleQuery);
            }

            // Log the activity of creating or updating the account
            const action = accountnumber ? 'updated' : 'created';
            console.log(`Rotary account ${action} successfully`);
            await activityMiddleware(req, user.id, `Rotary account ${action} successfully`, 'ROTARY_ACCOUNT');

            return res.status(accountnumber ? StatusCodes.OK : StatusCodes.CREATED).json({
                status: true,
                message: `Rotary account ${action} successfully`,
                statuscode: accountnumber ? StatusCodes.OK : StatusCodes.CREATED,
                data: account,
                errors: []
            });
        } catch (error) {
            console.error('Unexpected Error:', error);
            await activityMiddleware(req, user.id, 'An unexpected error occurred processing rotary account', 'ROTARY_ACCOUNT_ERROR');

            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "An unexpected error occurred",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: [error.message]
            });
        }
    };

    module.exports = { createOrUpdateRotaryAccount };