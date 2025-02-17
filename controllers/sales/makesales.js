const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");
const { activityMiddleware } = require("../../middleware/activity");
const { performTransaction } = require("../../middleware/transactions/performTransaction");

const makesales = async (req, res) => {
    const user = req.user;
    // Destructure the request body to extract necessary fields
    const { branchfrom, description, transactiondate, departmentfrom, rowsize, tfrom, reference, amountpaid, ...inventoryData } = req.body;
    // Generate a unique reference for the transaction
    const uniformReference = tfrom == 'BANK' ? reference : new Date().getTime().toString();

    let refamount = 0;

    if (tfrom == 'BANK' && !reference) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Reference is required when payment method is BANK",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null, 
            errors: ["Reference is required when payment method is BANK",]
        });
    }

    if(reference){
        // YOU WILL PUT THE FUNCTION TO VALIDATE THE TRANSACTION
        const { rows: existingTransactionRows } = await pg.query(`SELECT * FROM sky."transaction" WHERE transactionref = $1`, [reference]);
        if (existingTransactionRows.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "This payment reference has already been used for another transaction",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["This payment reference has already been used for another transaction"]
            });
        }
        refamount = parseFloat(amountpaid);
    }

    // Validate required fields
    if (!branchfrom || !departmentfrom || !rowsize || !tfrom || !amountpaid) {
        // Return a bad request response if any required field is missing
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "branchfrom, departmentfrom, and rowsize are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["branchfrom, departmentfrom, and rowsize are required"]
        });
    }

    // Validate the existence of the 'branchfrom'
    const { rows: branchFromRows } = await pg.query(`SELECT * FROM sky."Branch" WHERE id = $1`, [branchfrom]);
    if (branchFromRows.length === 0) {
        // Return a bad request response if 'branchfrom' does not exist
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Branch ${branchfrom} does not exist`,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: [`Branch ${branchfrom} does not exist`]
        });
    }

    // Validate the existence of the 'departmentfrom' in 'branchfrom'
    const { rows: departmentFromRows } = await pg.query(`SELECT * FROM sky."Department" WHERE id = $1 AND branch = $2`, [departmentfrom, branchfrom]);
    if (departmentFromRows.length === 0) {
        // Return a bad request response if 'departmentfrom' does not exist in 'branchfrom'
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Department ${departmentfrom} does not exist in branch ${branchfrom}`,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: [`Department ${departmentfrom} does not exist in branch ${branchfrom}`]
        });
    }

    
    // Initialize arrays to store item details
    const itemids = [];
    const qtys = [];
    const prices = [];
    const cost = [];
    const descriptions = [];
    const transactiondates = [];
    let totalPrice = 0;
    let totalProfit = 0;
    let totalCost = 0;
    

    // Loop through each item in the request body
    for (let i = 1; i <= rowsize; i++) {
        const itemIdKey = `itemid${i}`;
        const qtyKey = `qty${i}`;
        const priceKey = `price${i}`;
        const costKey = `cost${i}`;
        const requiredFields = [itemIdKey, qtyKey, priceKey, costKey];
        // Check for missing fields
        const missingFields = requiredFields.filter(field => !inventoryData[field]);
        if (missingFields.length > 0) {
            // Return a bad request response if any required field is missing
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `${missingFields.join(', ')} are required`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: [`${missingFields.join(', ')} are required`]
            });
        }
        // Push item details to respective arrays
        itemids.push(inventoryData[itemIdKey]);
        qtys.push(inventoryData[qtyKey]);
        prices.push(inventoryData[priceKey]);
        cost.push(inventoryData[costKey]);
        descriptions.push(inventoryData[description]);
        transactiondates.push(inventoryData[transactiondate]);
 
        // Calculate total price
        totalPrice += parseFloat(inventoryData[qtyKey]) * parseFloat(inventoryData[priceKey]);
        totalCost += parseFloat(inventoryData[qtyKey]) * parseFloat(inventoryData[costKey]);
    }
    
    // Calculate total profit
    totalProfit = totalPrice - totalCost;

    // Compare total price with amount paid
    if (totalPrice > req.body.amountpaid) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Total price ${totalPrice} exceeds the amount paid ${req.body.amountpaid}`,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: [`Total price ${totalPrice} exceeds the amount paid ${req.body.amountpaid}`]
        });
    }

    try {
        // Check if the quantity requested is greater than available stock for each itemid
        for (let i = 0; i < itemids.length; i++) {
            const { rows: inventoryRows } = await pg.query(`SELECT SUM(qty) AS totalQty FROM sky."Inventory" WHERE itemid = $1 AND branch = $2 AND department = $3`, [itemids[i], branchfrom, departmentfrom]);
            // console.log('inventoryRows:', inventoryRows, itemids[i], branchfrom, departmentfrom);
            const totalQty = inventoryRows[0].totalqty ?? 0;
            if (qtys[i] > totalQty) {
                // Return a bad request response if requested quantity is greater than available stock
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Quantity requested for itemid ${itemids[i]} is greater than available stock. Requested quantity: ${qtys[i]}, Available quantity: ${totalQty}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: [
                        `Quantity requested for itemid ${itemids[i]} is greater than available stock. Requested quantity: ${qtys[i]}, Available quantity: ${totalQty}`
                    ]
                });
            } 
        }

        await pg.query('BEGIN')

        // Process each itemid
        for (let i = 0; i < itemids.length; i++) {
            // Fetch fallback data for branchfrom and departmentfrom
            const { rows: fallbackRowsFrom } = await pg.query(`SELECT * FROM sky."Inventory" WHERE itemid = $1 AND branch = $2 AND department = $3 ORDER BY id DESC LIMIT 1`, [itemids[i], branchfrom, departmentfrom]);
            const fallbackDataFrom = fallbackRowsFrom.length > 0 ? fallbackRowsFrom[0] : {};

            // Update the qty to negative in branchfrom and departmentfrom
            const insertQuery = `
                INSERT INTO sky."Inventory" (
                    itemid, itemname, department, branch, units, cost, price, pricetwo, 
                    beginbalance, qty, minimumbalance, "group", applyto, itemclass, 
                    composite, compositeid, description, imageone, imagetwo, imagethree, 
                    status, "reference", transactiondate, transactiondesc, dateadded, 
                    createdby, sellingprice
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                    $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
                )
            `;

            const insertValues = [
                itemids[i], 
                fallbackDataFrom.itemname, 
                departmentfrom, 
                branchfrom, 
                fallbackDataFrom.units, 
                cost[i], 
                fallbackDataFrom.price, 
                fallbackDataFrom.pricetwo, 
                fallbackDataFrom.beginbalance, 
                -qtys[i], 
                fallbackDataFrom.minimumbalance, 
                fallbackDataFrom.group, 
                fallbackDataFrom.applyto, 
                fallbackDataFrom.itemclass, 
                fallbackDataFrom.composite, 
                fallbackDataFrom.compositeid, 
                fallbackDataFrom.description, 
                fallbackDataFrom.imageone, 
                fallbackDataFrom.imagetwo, 
                fallbackDataFrom.imagethree, 
                'ACTIVE', 
                uniformReference, 
                transactiondates[i] ?? new Date(), 
                'DEP-SALES', 
                new Date(), 
                req.user.id, 
                prices[i]
            ];

            const { rowCount: insertResult } = await pg.query(insertQuery, insertValues);
            if (insertResult === 0) {
                // Log activity for failed makesales
                await activityMiddleware(res, req.user.id, `Failed makesales for itemid ${itemids[i]}`, 'FAILED makesales');
                // Return an internal server error response if insertion fails
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                    status: false,
                    message: "Something went wrong",
                    statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                    data: null,
                    errors: ["Something went wrong"]
                });
            }
        }

        const { rows: orgSettingsRows } = await pg.query(`SELECT default_cost_of_sales_account, default_income_account FROM sky."Organisationsettings" LIMIT 1`);
        if (orgSettingsRows.length === 0) {
            console.error('Failed to fetch organisation settings');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Failed to fetch organisation settings",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["Failed to fetch organisation settings"]
            });
        }

        const itemnames = [];
        for (let i = 0; i < itemids.length; i++) {
            const { rows: itemRows } = await pg.query(`SELECT itemname FROM sky."Inventory" WHERE id = $1`, [itemids[i]]);
            if (itemRows.length > 0) {
                itemnames.push(itemRows[0].name);
            } else {
                itemnames.push(`Unknown Item ${itemids[i]}`);
            }
        }
        const { default_cost_of_sales_account, default_income_account } = orgSettingsRows[0];

        console.log('totalcost', totalCost);
        console.log('totalprofit', totalProfit);
        console.log('totalprice', totalPrice);


        if(tfrom == 'CASH'){
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
            const day = String(today.getDate()).padStart(2, '0');
            const dateString = `${year}${month}${day}`;
            const cashref = `CR-${dateString}-${req.user.id}`;
            const fromTransaction = {
                accountnumber: default_cost_of_sales_account, // Assuming the user's account number is available in the request
                credit: totalCost,
                debit: 0, 
                reference: uniformReference,
                transactiondate: new Date(),
                transactiondesc: `Cost of Sales by ${user.firstname} ${user.lastname} ${user.othernames}`,
                transactionref: uniformReference,
                currency: 'USD',
                description: itemnames.join(', '),
                branch: req.user.branch, // Assuming branch information is available
                registrationpoint: req.user.registrationpoint, // Assuming registration point is online
                ttype: 'CREDIT',
                cashref,
                tfrom: 'CASH',
                tax: false
            };

            const toTransaction = {
                accountnumber: default_income_account, // Assuming a default account number for the 'to' transaction
                credit: totalProfit,
                debit: 0,
                reference: uniformReference,
                transactiondate: new Date(),
                transactiondesc: `Profit of Sales by ${user.firstname} ${user.lastname} ${user.othernames}`,
                transactionref: uniformReference,
                currency: 'USD',
                description: itemnames.join(', '),
                branch: req.user.branch,
                registrationpoint: req.user.registrationpoint,
                ttype: 'CREDIT',
                cashref,
                tfrom: 'CASH',
                tax: false
            };

            try {
                const transactionResult = await performTransaction(fromTransaction, toTransaction, req.user.id, req.user.id);
                if (!transactionResult.status) {
                    console.error('Failed to perform transaction');
                    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                        status: false,
                        message: "Failed to perform transaction",
                        statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                        data: null,
                        errors: ["Failed to perform transaction"]
                    });
                }
            } catch (error) {
                console.error('Error processing transaction:', error);
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                    status: false,
                    message: "Error processing transaction",
                    statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                    data: null,
                    errors: [error.message]
                });
            }
        } else if (tfrom == 'BANK') {
            // Implement bank transaction logic here
            const bankTransaction = {
                accountnumber: default_income_account,
                credit: totalPrice,
                debit: 0,
                reference: uniformReference,
                transactiondate: new Date(),
                transactiondesc: `Bank sales by ${req.user.firstname} ${req.user.lastname}`,
                transactionref: uniformReference,
                currency: 'USD',
                description: itemnames.join(', '),
                branch: req.user.branch,
                registrationpoint: req.user.registrationpoint,
                ttype: 'CREDIT',
                cashref: reference,
                tfrom: 'BANK',
                tax: false
            };

            try {
                const transactionResult = await performTransaction(bankTransaction, null, req.user.id, req.user.id);
                if (!transactionResult.status) {
                    console.error('Failed to perform bank transaction');
                    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                        status: false,
                        message: "Failed to perform bank transaction",
                        statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                        data: null,
                        errors: ["Failed to perform bank transaction"]
                    });
                }
            } catch (error) {
                console.error('Error processing bank transaction:', error);
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                    status: false,
                    message: "Error processing bank transaction",
                    statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                    data: null,
                    errors: [error.message]
                });
            }
        }

        // Log activity for successful makesales
        await activityMiddleware(res, req.user.id, `Sales processed for branch ${branchfrom}`, 'SALES PROCESSED');

        // Prepare sales data for the receipt
        // Fetch branch name from Branch table using branchfrom
        const { rows: branchRows } = await pg.query(`SELECT branch FROM sky."Branch" WHERE id = $1`, [branchfrom]);
        const branchName = branchRows.length > 0 ? branchRows[0].branch : "Unknown Branch";

        const salesData = {
            branch: branchName,
            department: departmentfrom,
            reference: uniformReference,
            transactionDate: new Date(),
            totalPrice,
            totalCost,
            totalProfit,
            items: await Promise.all(itemids.map(async (itemId, index) => {
                // Fetch item name from Inventory table using itemId
                const { rows: inventoryRows } = await pg.query(`SELECT itemname FROM sky."Inventory" WHERE itemid = $1`, [itemId]);
                const itemName = inventoryRows.length > 0 ? inventoryRows[0].itemname : "Unknown Item";

                return {
                    itemId,
                    itemname: itemName,
                    quantity: qtys[index],
                    price: prices[index],
                    cost: cost[index],
                    value: parseFloat(qtys[index]) * parseFloat(prices[index])
                };
            })),
            amountPaid: parseFloat(amountpaid),
            paymentMethod: tfrom,
            description: description || ''
        };

        // Commit the transaction
        await pg.query('COMMIT');

        // Return success response with sales data
        return res.status(StatusCodes.OK).json({ 
            status: true,
            message: "Sales processed successfully",
            statuscode: StatusCodes.OK,
            data: salesData,
            errors: []
        });

    } catch (error) {
        // Rollback the transaction in case of error
        await pg.query('ROLLBACK');
        // Log and return error response
        console.error(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

module.exports = { makesales };