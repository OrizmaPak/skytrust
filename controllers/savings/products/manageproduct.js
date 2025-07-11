const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const pg = require("../../../db/pg"); // Import PostgreSQL pg
const { addOneDay } = require("../../../utils/expiredate"); // Import utility for adding one day to a date
const { divideAndRoundUp } = require("../../../utils/pageCalculator"); // Import utility for pagination calculations
const { activityMiddleware } = require("../../../middleware/activity"); // Import activity middleware
const { validateCode } = require("../../../utils/datecode");

// Function to handle POST request for creating or updating a savings product
const manageSavingsProduct = async (req, res) => {
    console.log("Starting manageSavingsProduct function");
    let {
        id, 
        productname,
        currency,
        maxbalance = 0,
        allowdeposit = false,
        allowwithdrawal = false,
        withdrawallimit = 0,
        withdrawalcharges = 0,
        withdrawalchargetype,
        withdrawalchargeinterval,
        depositcharge = 0,
        depositechargetype = "PERCENTAGE",
        withdrawallimittype,
        chargehere = false,
        activationfee = 0,
        minimumaccountbalance = 0,
        allowoverdrawn = false,
        compulsorydeposit = false,
        compulsorydeposittype,
        compulsorydepositspillover = false,
        compulsorydepositfrequency,
        compulsorydepositfrequencyamount = 0, 
        compulsorydepositfrequencyskip = 0,
        compulsorydepositpenalty = 0,
        compulsorydepositpenaltytype,
        compulsorydepositpenaltyfrom,
        compulsorydepositpenaltyfallbackfrom,
        compulsorydepositdeficit = false,
        status = "ACTIVE",
        membership = "",
        interestrowsize = 0,
        deductionrowsize = 0,
        withdrawalcontrol = false,
        withdrawalcontrolamount = 0,
        withdrawalcontrolsize,
        withdrawalcontroltype,
        withdrawalcontrolwindow,
        eligibilityaccountage = 0,
        eligibilityminbalance = 0,
        eligibilitymincredit = 0,
        eligibilitymindebit = 0,
        eligibilityminimumclosedaccounts = 0,
        eligibilityminimumloan = 0,
        eligibilityproduct = 0,
        eligibilityproductcategory,
        useraccount = 1,
        addmember = "NO",
        ...body
    } = req.body;
    console.log("Extracted request body and user1");
    
    // Override default values with those from the body if they exist
    try {            
        maxbalance = req.body.maxbalance != null && req.body.maxbalance.length ? req.body.maxbalance : 0;
        allowdeposit = req.body.allowdeposit ? true : false;
        allowwithdrawal = req.body.allowwithdrawal ? true : false;
        withdrawallimit = req.body.withdrawallimit != null && req.body.withdrawallimit.length ? req.body.withdrawallimit : 0;
        withdrawalcharges = req.body.withdrawalcharges != null && req.body.withdrawalcharges.length ? req.body.withdrawalcharges : 0;
        depositcharge = req.body.depositcharge != null && req.body.depositcharge.length ? req.body.depositcharge : 0;
        chargehere = req.body.chargehere ? true : false;
        activationfee = req.body.activationfee != null && req.body.activationfee.length ? req.body.activationfee : 0;
        minimumaccountbalance = req.body.minimumaccountbalance != null && req.body.minimumaccountbalance.length ? req.body.minimumaccountbalance : 0;
        allowoverdrawn = req.body.allowoverdrawn ? true : false;
        compulsorydeposit = req.body.compulsorydeposit ? true : false;
        compulsorydepositspillover = req.body.compulsorydepositspillover ? true : false;
        compulsorydepositfrequencyamount = req.body.compulsorydepositfrequencyamount != null && req.body.compulsorydepositfrequencyamount.length ? req.body.compulsorydepositfrequencyamount : 0;
        compulsorydepositfrequencyskip = req.body.compulsorydepositfrequencyskip != null && req.body.compulsorydepositfrequencyskip.length ? req.body.compulsorydepositfrequencyskip : 0;
        compulsorydepositpenalty = req.body.compulsorydepositpenalty != null && req.body.compulsorydepositpenalty.length ? req.body.compulsorydepositpenalty : 0; 
        compulsorydepositdeficit = req.body.compulsorydepositdeficit ? true : false;
        withdrawalcontrol = req.body.withdrawalcontrol ? true : false;
        withdrawalcontrolamount = req.body.withdrawalcontrolamount != null && req.body.withdrawalcontrolamount.length ? req.body.withdrawalcontrolamount : 0;
        eligibilityaccountage = req.body.eligibilityaccountage != null && req.body.eligibilityaccountage.length ? req.body.eligibilityaccountage : 0;
        eligibilityminbalance = req.body.eligibilityminbalance != null && req.body.eligibilityminbalance.length ? req.body.eligibilityminbalance : 0;
        eligibilitymincredit = req.body.eligibilitymincredit != null && req.body.eligibilitymincredit.length ? req.body.eligibilitymincredit : 0;
        eligibilitymindebit = req.body.eligibilitymindebit != null && req.body.eligibilitymindebit.length ? req.body.eligibilitymindebit : 0;
        eligibilityminimumclosedaccounts = req.body.eligibilityminimumclosedaccounts != null && req.body.eligibilityminimumclosedaccounts.length ? req.body.eligibilityminimumclosedaccounts : 0;
        eligibilityminimumloan = req.body.eligibilityminimumloan != null && req.body.eligibilityminimumloan.length ? req.body.eligibilityminimumloan : 0;
        eligibilityproduct = req.body.eligibilityproduct != null && req.body.eligibilityproduct.length ? req.body.eligibilityproduct : 0;
        useraccount = req.body.useraccount ?? 1;
        addmember = req.body.addmember || "NO";
    } catch (error) {
        console.error("Error processing request body:", error);
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid request body data.",
            errors: [error.message]
        });
    }

    console.log("Extracted request body and user2");
    const user = req.user;
    console.log("Extracted request body and user3");

    // Currency validation
    const validCurrencies = ["USD", "USD"];
    if (!validCurrencies.includes(currency)) {
        console.log("Invalid currency detected");
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Invalid currency: ${currency}. Allowed values: ${validCurrencies.join(", ")}.`,
            errors: ["Invalid currency"]
        });
    }

    // Withdrawal charge type validation
    const validChargeTypes = ["PERCENTAGE", "AMOUNT"];
    if (withdrawalchargetype && !validChargeTypes.includes(withdrawalchargetype)) {
        console.log("Invalid withdrawalchargetype detected");
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Invalid 'withdrawalchargetype': ${withdrawalchargetype}. Allowed values: ${validChargeTypes.join(", ")}.`,
            errors: ["Invalid withdrawalchargetype"]
        });
    }

    // Withdrawal charge interval validation
    if (withdrawalchargeinterval && !validateCode(withdrawalchargeinterval)) {
        console.log("Invalid withdrawalchargeinterval detected");
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid 'withdrawalchargeinterval' value.",
            errors: ["Invalid withdrawalchargeinterval"]
        });
    }

    // Withdrawal limit type validation
    if (withdrawallimittype && !validChargeTypes.includes(withdrawallimittype)) {
        console.log("Invalid withdrawallimittype detected");
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Invalid 'withdrawallimittype': ${withdrawallimittype}. Allowed values: ${validChargeTypes.join(", ")}.`,
            errors: ["Invalid withdrawallimittype"]
        });
    }

    // Deposit charge type validation
    if (!validChargeTypes.includes(depositechargetype)) {
        console.log("Invalid depositechargetype detected");
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Invalid 'depositechargetype': ${depositechargetype}. Allowed values: ${validChargeTypes.join(", ")}.`,
            errors: ["Invalid depositechargetype"]
        });
    }

    // Compulsory deposit type validation
    const validCompulsoryDepositTypes = ["FIXED", "MINIMUM"];
    if (compulsorydeposittype && !validCompulsoryDepositTypes.includes(compulsorydeposittype)) {
        console.log("Invalid compulsorydeposittype detected");
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Invalid 'compulsorydeposittype': ${compulsorydeposittype}. Allowed values: ${validCompulsoryDepositTypes.join(", ")}.`,
            errors: ["Invalid compulsorydeposittype"]
        });
    }

    // Compulsory deposit frequency validation
    if (compulsorydepositfrequency && !validateCode(compulsorydepositfrequency)) {
        console.log("Invalid compulsorydepositfrequency detected");
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid 'compulsorydepositfrequency' value.",
            errors: ["Invalid compulsorydepositfrequency"]
        });
    }

    // Compulsory deposit penalty type validation
    if (compulsorydepositpenaltytype && !validChargeTypes.includes(compulsorydepositpenaltytype)) {
        console.log("Invalid compulsorydepositpenaltytype detected");
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Invalid 'compulsorydepositpenaltytype': ${compulsorydepositpenaltytype}. Allowed values: ${validChargeTypes.join(", ")}.`,
            errors: ["Invalid compulsorydepositpenaltytype"]
        });
    }

    // Check penalty and deficit consistency
    if ((compulsorydepositdeficit === true || compulsorydepositdeficit === "true") && compulsorydepositpenalty !== 0) {
        console.log("Inconsistent penalty and deficit detected");
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "The 'compulsorydepositpenalty' must be zero when 'compulsorydepositdeficit' is true.",
            errors: ["Invalid compulsorydepositpenalty"]
        });
    }

    // Ensure compulsory deposit frequency amount is provided if compulsorydeposit is true
    if ((compulsorydeposit === true || compulsorydeposit === "true") && !compulsorydepositfrequencyamount) {
        console.log("Missing compulsorydepositfrequencyamount detected");
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "The 'compulsorydepositfrequencyamount' is required when 'compulsorydeposit' is true.",
            errors: ["Missing compulsorydepositfrequencyamount"]
        });
    }

    // Membership validation
    if (membership) {
        console.log("Validating membership IDs");
        // Split membership by '|' to handle multiple memberships
        const membershipIds = membership.split('||').map(id => id.trim());

        // Check if all membershipIds are valid numbers
        const invalidIds = membershipIds.filter(id => !/^\d+$/.test(id));
        if (invalidIds.length > 0) {
            console.log("Invalid membership ID(s) detected");
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Invalid membership ID(s): ${invalidIds.join(", ")}. Membership IDs must be numeric.`,
                errors: ["Invalid membership ID format"]
            });
        }

        // Convert to integers
        const numericMembershipIds = membershipIds.map(id => parseInt(id, 10));

        // Query to check existence of all membership IDs
        const queryText = `SELECT id FROM skyeu."DefineMember" WHERE id = ANY($1::int[])`;
        const { rows: existingMemberships } = await pg.query(queryText, [numericMembershipIds]);

        const existingIds = existingMemberships.map(row => row.id);
        const nonExistentIds = numericMembershipIds.filter(id => !existingIds.includes(id));

        if (nonExistentIds.length > 0) {
            console.log("Non-existent membership ID(s) detected");
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Membership ID(s) not found: ${nonExistentIds.join(", ")}.`,
                errors: ["Invalid membership ID(s)"]
            });
        }
    }

    // Process interests and deductions arrays
    const interests = [];
    const deductions = [];
    console.log("Processing interests and deductions");

    // Process interests
    for (let i = 1; i <= interestrowsize; i++) {
        console.log(`Processing interest ${i}`);
        const interest = {
            interestname: body[`interestname${i}`],
            interestmethod: body[`interestmethod${i}`],
            interesteligibilityaccountage: parseInt(body[`interesteligibilityaccountage${i}`] || 0, 10),
            interesteligibilitybalance: parseFloat(body[`interesteligibilitybalance${i}`] || 0),
            interestamount: parseFloat(body[`interestamount${i}`]),
            interesttype: body[`interesttype${i}`],
            interestfrequency: body[`interestfrequency${i}`],
            interestfrequencynumber: parseInt(body[`interestfrequencynumber${i}`] || 0, 10),
            interestfrequencyskip: parseInt(body[`interestfrequencyskip${i}`] || 0, 10),
            interestgoforapproval: body[`interestgoforapproval${i}`] ? true : false,
            status: body[`intereststatus${i}`] || "ACTIVE"
        };

        console.log(`Interest details: ${JSON.stringify(interest)}`);

        // Validate interesttype
        const validInterestTypes = ["PERCENTAGE", "AMOUNT"];
        if (!validInterestTypes.includes(interest.interesttype)) {
            console.log(`Invalid interesttype detected: ${interest.interesttype}`, res);
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Invalid 'interesttype': ${interest.interesttype}. Allowed values: ${validInterestTypes.join(", ")}.`,
                errors: ["Invalid interesttype"]
            });
        } 
        console.log(interest.interestfrequency);
        console.log(validateCode(interest.interestfrequency));
        // Validate interestfrequency
        if (!validateCode(interest.interestfrequency)) {
            console.log(`Invalid interestfrequency detected: ${interest.interestfrequency}`);
            return res.status(StatusCodes.BAD_REQUEST).json({ 
                status: false,
                message: "Invalid 'interestfrequency' value.",
                errors: ["Invalid interestfrequency"]  
            });
        } else {
            console.log(`Valid interestfrequency: ${interest.interestfrequency}`);
        }

        interests.push(interest);
        console.log(`Interest ${i} added to the list`);
    }

    // Process deductions
    for (let i = 1; i <= deductionrowsize; i++) {
        console.log(`Processing deduction ${i}`);
        const deduction = {
            deductionname: body[`deductionname${i}`],        
            deductioneligibilityaccountage: parseInt(body[`deductioneligibilityaccountage${i}`] || 0, 10),
            deductioneligibilitybalance: parseFloat(body[`deductioneligibilitybalance${i}`] || 0),
            deductionamount: parseFloat(body[`deductionamount${i}`]),
            deductiontype: body[`deductiontype${i}`],
            deductionmethod: body[`deductionmethod${i}`],
            deductionfrequency: body[`deductionfrequency${i}`],
            deductionfrequencynumber: parseInt(body[`deductionfrequencynumber${i}`] || 0, 10),
            deductionfrequencyskip: parseInt(body[`deductionfrequencyskip${i}`] || 0, 10),
            deductiongoforapproval: body[`deductiongoforapproval${i}`] ? true : false,
            status: body[`deductionstatus${i}`] || "ACTIVE"
        };

        // Validate deductiontype 
        const validDeductionTypes = ["PERCENTAGE", "AMOUNT"];
        if (!validDeductionTypes.includes(deduction.deductiontype)) {
            console.log("Invalid deductiontype detected");
            return res.status(StatusCodes.BAD_REQUEST).json({ 
                status: false,
                message: `Invalid 'deductiontype': ${deduction.deductiontype}. Allowed values: ${validDeductionTypes.join(", ")}.`,
                errors: ["Invalid deductiontype"]
            });
        }

        // Validate deductionmethod
        const validDeductionMethods = ["LATEST BALANCE", "PRO RATA BASIS"];
        if (!validDeductionMethods.includes(deduction.deductionmethod)) {
            console.log("Invalid deductionmethod detected");
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Invalid 'deductionmethod': ${deduction.deductionmethod}. Allowed values: ${validDeductionMethods.join(", ")}.`,
                errors: ["Invalid deductionmethod"]
            });
        }

        // Validate deductionfrequency
        if (!validateCode(deduction.deductionfrequency)) {
            console.log("Invalid deductionfrequency detected", deduction.deductionfrequency);
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Invalid 'deductionfrequency' value.",
                errors: ["Invalid deductionfrequency"]
            });
        }

        deductions.push(deduction);
    } 

    try {
        console.log("Starting database transaction");
        await pg.query("BEGIN"); // Start transaction

        if (id) {
            console.log("Updating existing product");
            // Update existing product
            const { rows: existingProductById } = await pg.query(`SELECT * FROM skyeu."savingsproduct" WHERE id = $1`, [id]);
            if (existingProductById.length === 0) {
                console.log("Product with provided ID does not exist");
                await pg.query("ROLLBACK");
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Product with the provided ID does not exist.",
                    errors: ["Nonexistent product"]
                });
            }

            const adjustedCompulsoryDepositPenalty = compulsorydepositdeficit ? 0 : compulsorydepositpenalty;

            await pg.query(
                `UPDATE skyeu."savingsproduct" SET
                    productname = $1,
                    currency = $2,
                    maxbalance = $3,
                    allowdeposit = $4,
                    allowwithdrawal = $5,
                    withdrawallimit = $6,
                    withdrawalcharges = $7,
                    withdrawalchargetype = $8,
                    withdrawalchargeinterval = $9,
                    depositcharge = $10,
                    depositechargetype = $11,
                    withdrawallimittype = $12,
                    chargehere = $13,
                    activationfee = $14,
                    minimumaccountbalance = $15,
                    allowoverdrawn = $16,
                    compulsorydeposit = $17,
                    compulsorydeposittype = $18,
                    compulsorydepositspillover = $19,
                    compulsorydepositfrequency = $20,
                    compulsorydepositfrequencyamount = $21,
                    compulsorydepositfrequencyskip = $22,
                    compulsorydepositpenalty = $23,
                    compulsorydepositpenaltytype = $24,
                    compulsorydepositpenaltyfrom = $25,
                    compulsorydepositpenaltyfallbackfrom = $26,
                    compulsorydepositdeficit = $27,
                    membership = $28,
                    status = $29,
                    withdrawalcontrol = $30,
                    withdrawalcontrolamount = $31,
                    withdrawalcontrolsize = $32,
                    withdrawalcontroltype = $33,
                    withdrawalcontrolwindow = $34,
                    eligibilityaccountage = $35,
                    eligibilityminbalance = $36,
                    eligibilitymincredit = $37,
                    eligibilitymindebit = $38,
                    eligibilityminimumclosedaccounts = $39,
                    eligibilityminimumloan = $40,
                    eligibilityproduct = $41,
                    eligibilityproductcategory = $42,
                    useraccount = $43,
                    addmember = $44,
                    updatedat = NOW()
                WHERE id = $45`,
                [
                    productname,
                    currency,
                    maxbalance,
                    allowdeposit,
                    allowwithdrawal,
                    withdrawallimit,
                    withdrawalcharges,
                    withdrawalchargetype,
                    withdrawalchargeinterval,
                    depositcharge,
                    depositechargetype,
                    withdrawallimittype,
                    chargehere,
                    activationfee,
                    minimumaccountbalance,
                    allowoverdrawn,
                    compulsorydeposit,
                    compulsorydeposittype,
                    compulsorydepositspillover,
                    compulsorydepositfrequency,
                    compulsorydepositfrequencyamount,
                    compulsorydepositfrequencyskip,
                    adjustedCompulsoryDepositPenalty,
                    compulsorydepositpenaltytype,
                    compulsorydepositpenaltyfrom,
                    compulsorydepositpenaltyfallbackfrom,
                    compulsorydepositdeficit,
                    membership,
                    status,
                    withdrawalcontrol,
                    withdrawalcontrolamount,
                    withdrawalcontrolsize,
                    withdrawalcontroltype,
                    withdrawalcontrolwindow,
                    eligibilityaccountage,
                    eligibilityminbalance,
                    eligibilitymincredit,
                    eligibilitymindebit,
                    eligibilityminimumclosedaccounts,
                    eligibilityminimumloan,
                    eligibilityproduct,
                    eligibilityproductcategory,
                    useraccount,
                    addmember,
                    id
                ]
            );

            console.log("Deleted existing interests and deductions");
            // Delete existing interests and deductions
            await pg.query(`DELETE FROM skyeu."Interest" WHERE savingsproductid = $1`, [id]);
            await pg.query(`DELETE FROM skyeu."Deduction" WHERE savingsproductid = $1`, [id]);

            console.log("Inserting new interests");
            // Insert new interests
            for (const interest of interests) {
                await pg.query(
                    `INSERT INTO skyeu."Interest" (
                        savingsproductid,
                        interestname,
                        interestmethod,
                        interesteligibilityaccountage,
                        interesteligibilitybalance,
                        interestamount,
                        interesttype,
                        interestfrequency,
                        interestfrequencynumber,
                        interestfrequencyskip,
                        interestgoforapproval,
                        status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        id, 
                        interest.interestname,
                        interest.interestmethod,
                        interest.interesteligibilityaccountage,
                        interest.interesteligibilitybalance,
                        interest.interestamount,
                        interest.interesttype,
                        interest.interestfrequency,
                        interest.interestfrequencynumber,
                        interest.interestfrequencyskip,
                        interest.interestgoforapproval,
                        interest.status
                    ]
                );
            }

            console.log("Inserting new deductions");
            // Insert new deductions
            for (const deduction of deductions) {
                await pg.query(
                    `INSERT INTO skyeu."Deduction" (
                        savingsproductid,
                        deductionname,
                        deductioneligibilityaccountage,
                        deductioneligibilitybalance,
                        deductionamount,
                        deductiontype,
                        deductionmethod,
                        deductionfrequency,
                        deductionfrequencynumber,
                        deductionfrequencyskip,
                        deductiongoforapproval,
                        status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        id,
                        deduction.deductionname,
                        deduction.deductioneligibilityaccountage,
                        deduction.deductioneligibilitybalance,
                        deduction.deductionamount,
                        deduction.deductiontype,
                        deduction.deductionmethod,
                        deduction.deductionfrequency,
                        deduction.deductionfrequencynumber,
                        deduction.deductionfrequencyskip,
                        deduction.deductiongoforapproval,
                        deduction.status
                    ]
                );
            }

            await pg.query('COMMIT'); // Commit transaction
            console.log("Transaction committed for product update");

            // Record the activity
            await activityMiddleware(res, user.id, `${productname} Product updated`, 'PRODUCT');
            console.log("Activity recorded for product update");

            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Product updated successfully",
                statuscode: StatusCodes.OK,
                errors: []
            });
        } else {
            console.log("Creating new product");
            // Create new product
            const { rows: existingProduct } = await pg.query(`SELECT * FROM skyeu."savingsproduct" WHERE productname = $1`, [productname]);
            if (existingProduct.length > 0) {
                console.log("Product already exists");
                await pg.query("ROLLBACK");
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Product already exists",
                    errors: ["Product already exists"]
                });
            };

            const adjustedCompulsoryDepositPenalty = compulsorydepositdeficit ? 0 : compulsorydepositpenalty;

            const insertProductQuery = `
                INSERT INTO skyeu."savingsproduct" (
                    productname,
                    currency,
                    maxbalance,
                    allowdeposit,
                    allowwithdrawal,
                    withdrawallimit,
                    withdrawalcharges,
                    withdrawalchargetype,
                    withdrawalchargeinterval,
                    depositcharge,
                    depositechargetype,
                    withdrawallimittype,
                    chargehere,
                    activationfee,
                    minimumaccountbalance,
                    allowoverdrawn,
                    compulsorydeposit,
                    compulsorydeposittype,
                    compulsorydepositspillover,
                    compulsorydepositfrequency,
                    compulsorydepositfrequencyamount,
                    compulsorydepositfrequencyskip,
                    compulsorydepositpenalty,
                    compulsorydepositpenaltytype,
                    compulsorydepositpenaltyfrom,
                    compulsorydepositpenaltyfallbackfrom,
                    compulsorydepositdeficit,
                    membership,
                    status,
                    withdrawalcontrol,
                    withdrawalcontrolamount,
                    withdrawalcontrolsize,
                    withdrawalcontroltype,
                    withdrawalcontrolwindow,
                    eligibilityaccountage,
                    eligibilityminbalance,
                    eligibilitymincredit,
                    eligibilitymindebit,
                    eligibilityminimumclosedaccounts,
                    eligibilityminimumloan,
                    eligibilityproduct,
                    eligibilityproductcategory,
                    useraccount,
                    addmember,
                    dateadded
                ) VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15,
                    $16, $17, $18, $19, $20,
                    $21, $22, $23, $24, $25,
                    $26, $27, $28, $29, $30,
                    $31, $32, $33, $34, $35,
                    $36, $37, $38, $39, $40,
                    $41, $42, $43, $44, NOW()
                ) RETURNING id`;

            const values = [
                productname,
                currency,
                maxbalance,
                allowdeposit,
                allowwithdrawal,
                withdrawallimit,
                withdrawalcharges,
                withdrawalchargetype,
                withdrawalchargeinterval,
                depositcharge,
                depositechargetype,
                withdrawallimittype,
                chargehere,
                activationfee, 
                minimumaccountbalance,
                allowoverdrawn,
                compulsorydeposit,
                compulsorydeposittype,
                compulsorydepositspillover,
                compulsorydepositfrequency,
                compulsorydepositfrequencyamount,
                compulsorydepositfrequencyskip,
                adjustedCompulsoryDepositPenalty,
                compulsorydepositpenaltytype,
                compulsorydepositpenaltyfrom,
                compulsorydepositpenaltyfallbackfrom,
                compulsorydepositdeficit,
                membership,
                status,
                withdrawalcontrol,
                withdrawalcontrolamount,
                withdrawalcontrolsize,
                withdrawalcontroltype,
                withdrawalcontrolwindow,
                eligibilityaccountage,
                eligibilityminbalance,
                eligibilitymincredit,
                eligibilitymindebit,
                eligibilityminimumclosedaccounts,
                eligibilityminimumloan,
                eligibilityproduct,
                eligibilityproductcategory,
                useraccount,
                addmember
            ];

            const { rows } = await pg.query(insertProductQuery, values);
            const newId = rows[0].id;
            console.log(`New product created with ID: ${newId}`);

            // Insert interests
            for (const interest of interests) {
                await pg.query(
                    `INSERT INTO skyeu."Interest" (
                        savingsproductid,
                        interestname,
                        interestmethod,
                        interesteligibilityaccountage,
                        interesteligibilitybalance,
                        interestamount,
                        interesttype,
                        interestfrequency,
                        interestfrequencynumber,
                        interestfrequencyskip, 
                        interestgoforapproval,
                        status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        newId,
                        interest.interestname,
                        interest.interestmethod,
                        interest.interesteligibilityaccountage,
                        interest.interesteligibilitybalance,
                        interest.interestamount, 
                        interest.interesttype,
                        interest.interestfrequency,
                        interest.interestfrequencynumber,  
                        interest.interestfrequencyskip,
                        interest.interestgoforapproval,
                        interest.status
                    ]
                );
            }
            console.log("Interests inserted for new product");

            // Insert deductions
            for (const deduction of deductions) {
                await pg.query(
                    `INSERT INTO skyeu."Deduction" (
                        savingsproductid,
                        deductionname,
                        deductioneligibilityaccountage,
                        deductioneligibilitybalance,
                        deductionamount,
                        deductiontype,
                        deductionmethod,
                        deductionfrequency,
                        deductionfrequencynumber,
                        deductionfrequencyskip,
                        deductiongoforapproval,
                        status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        newId,
                        deduction.deductionname,
                        deduction.deductioneligibilityaccountage,
                        deduction.deductioneligibilitybalance,
                        deduction.deductionamount,
                        deduction.deductiontype,
                        deduction.deductionmethod,
                        deduction.deductionfrequency,
                        deduction.deductionfrequencynumber,
                        deduction.deductionfrequencyskip,
                        deduction.deductiongoforapproval,
                        deduction.status
                    ]
                );
            }
            console.log("Deductions inserted for new product");

            await pg.query('COMMIT'); // Commit transaction
            console.log("Transaction committed for new product creation");

            // Record the activity
            await activityMiddleware(res, user.id, `${productname} Product created`, 'PRODUCT');
            console.log("Activity recorded for new product creation");

            return res.status(StatusCodes.CREATED).json({
                status: true,
                message: "Product created successfully",
                statuscode: StatusCodes.CREATED,
                errors: []
            });
        }
    } catch (error) {
        await pg.query('ROLLBACK'); // Rollback transaction on error
        console.error("Error occurred:", error); // Log the error for debugging
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            errors: ["An unexpected error occurred while managing the savings product"]
        });
    }
};
    
module.exports = {
    manageSavingsProduct
};
