// Import required modules
const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { v4: uuidv4 } = require('uuid');
const { activityMiddleware } = require("../../../middleware/activity");
const { performTransactionOneWay, performTransaction } = require("../../../middleware/transactions/performTransaction");

// Function to handle opening stock request for multiple items
const manageReceivePurchases = async (req, res) => {
    // Extract rowsize from request body
    const rowsize = req.body.rowsize;
    if (!rowsize) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Rows size is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: '',
            errors: ["Rows size is required"]  
        });
    }

    const reference = req.body.reference;

    // Extract user from request
    const user = req.user;

    try { 
        // Initialize an array to hold all the inventory items to be inserted
        const inventoryItems = [];

        if (!req.body[`supplier`]) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Supplier is required`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: '',
                errors: [`Supplier is required`]
            });
        }

        if (!req.body.tfrom || (req.body.tfrom != 'CASH' && req.body.tfrom != 'BANK')) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Payment method must be either 'CASH' or 'BANK'",
                statuscode: StatusCodes.BAD_REQUEST,
                data: '',
                errors: ["Payment method must be either 'CASH' or 'BANK'"]
            });
        }

        const tfrom = req.body.tfrom;

        // Confirm that the supplier exists
        const supplierQuery = await pg.query(`SELECT * FROM sky."Supplier" WHERE id = $1`, [req.body[`supplier`]]);
        if (!supplierQuery.rows[0]) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `Supplier with ID ${req.body[`supplier`]} does not exist`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: '',
                errors: [`Supplier with ID ${req.body[`supplier`]} does not exist`]
            });
        }

        const supplier = supplierQuery.rows[0]

        // Loop through each item based on rowsize
        for (let i = 1; i <= rowsize; i++) {
            // Extract id from request body
            const itemid = req.body[`itemid${i}`];
            // Query to select inventory item by itemid
            const inventory = await pg.query(`SELECT * FROM sky."Inventory" WHERE itemid = $1 AND status = 'ACTIVE'`, [itemid]);

            console.log('inventory', inventory.rows)
            // Check if inventory item is not found
            if (!inventory.rows[0]) {
                // Return error response if inventory item not found
                return res.status(StatusCodes.OK).json({
                    status: false,
                    message: `Inventory item ${itemid} not found`,
                    statuscode: StatusCodes.OK,
                    data: '',
                    errors: [`Inventory item ${itemid} not found`]  
                });
            }

            // Clone the inventory item to modify its properties
            const clonedInventory = { ...inventory.rows[0] };

            const refinstance = new Date().getTime().toString();

            // Ensure qty, cost, department, and branch have values from the request body
            if (!req.body[`qty${i}`]) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Quantity for item ${itemid} is required`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: '',
                    errors: [`Quantity for item ${itemid} is required`]
                });
            }

            if (!req.body[`cost${i}`]) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Cost for item ${itemid} is required`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: '',
                    errors: [`Cost for item ${itemid} is required`]
                });
            }

            if (!req.body[`department`]) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Department for item ${itemid} is required`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: '',
                    errors: [`Department for item ${itemid} is required`]
                });
            }

            if (!req.body[`branch`]) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Branch for item ${itemid} is required`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: '',
                    errors: [`Branch for item ${itemid} is required`]
                });
            }

            // Confirm that the branch exists
            const branchQuery = await pg.query(`SELECT * FROM sky."Branch" WHERE id = $1`, [req.body[`branch`]]);
            if (!branchQuery.rows[0]) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Branch with ID ${req.body[`branch`]} does not exist`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: '',
                    errors: [`Branch with ID ${req.body[`branch`]} does not exist`]
                });
            }

            // Update cloned inventory properties with request body values if provided
            clonedInventory.qty = req.body[`qty${i}`];
            clonedInventory.cost = req.body[`cost${i}`] || clonedInventory.cost;
            clonedInventory.department = req.body[`department`];
            clonedInventory.branch = req.body[`branch`];
            clonedInventory.transactiondate = req.body[`transactiondate${i}`] || new Date(); // Set transaction date to current date
            clonedInventory.transactiondesc = (req.body[`transactiondesc${i}`] ?? '') + 'Received from supplier'; // Set transaction description
            clonedInventory.transactionref = req.body[`transactionref`] && req.body[`transactionref`].replaceAll('PO-', 'RP-') ||  `RP-${refinstance}`; // Set transaction description
            clonedInventory.supplier = req.body[`supplier`]; // Set transaction description
            clonedInventory.reference = reference.includes('||') ? reference.split('||')[0].replaceAll('PO', 'RP') + '||' + req.body['supplier']+'||'+req.body['paymentref']??null : `RP-${new Date().getTime().toString()}||${req.body[`supplier`]}||${req.body[`paymentref`]??null}`; // Use provided reference or generate new one
            clonedInventory.createdby = user.id; // Set created by to the current user

            // Add the cloned inventory item to the array
            inventoryItems.push(clonedInventory);
        }

        await pg.query('BEGIN');
        try {
            // Insert cloned inventory items into the database
            for (const item of inventoryItems) {
                await pg.query(`INSERT INTO sky."Inventory" (
                    itemid, itemname, department, branch, units, cost, price, pricetwo, 
                    beginbalance, qty, minimumbalance, "group", applyto, itemclass, 
                    composite, compositeid, description, imageone, imagetwo, imagethree, 
                    status, "reference", transactiondate, transactiondesc, transactionref, createdby, dateadded
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                    $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
                )`, [
                    item.itemid, item.itemname, item.department, 
                    item.branch, item.units, item.cost, 
                    item.price, item.pricetwo, item.beginbalance, 
                    item.qty, item.minimumbalance, item.group, 
                    item.applyto, item.itemclass, item.composite, 
                    item.compositeid, item.description, item.imageone, 
                    item.imagetwo, item.imagethree, 'ACTIVE', 
                    item.reference, item.transactiondate, item.transactiondesc, 
                    item.transactionref, user.id, new Date()
                ]);

                // Log activity for opening stock
                // Get the department from the department table
                const { rows: department } = await pg.query(`SELECT department FROM sky."Department" WHERE id = $1`, [item.department]);
                // Get the branch from the branch table
                const { rows: branch } = await pg.query(`SELECT branch FROM sky."Branch" WHERE id = $1`, [item.branch]);
                // Log activity for opening stock
                await activityMiddleware(res, req.user.id, `Opening stock added for item ${item.itemname} in department ${department[0].department} and branch ${branch[0].branch} with quantity ${item.qty}`, 'OPEN STOCK');
            }

            // HANDLE TRANSACTIONS
            // GET TOTAL VALUE OF ITEMS
            const totalValue = inventoryItems.reduce((acc, item) => acc + item.qty * item.cost, 0);
            // get the supplier
            
            // get the organisation settings
            const orgSettings = (await pg.query(`SELECT * FROM sky."Organisationsettings" LIMIT 1`)).rows[0];

            const reqbody = req.body;

            
            const userAllocationBalanceQuery = `
                SELECT COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) AS balance 
                FROM sky."transaction" 
                WHERE accountnumber = $1 AND userid = $2 AND status = 'ACTIVE' AND tfrom = $3
            `;
            
            const userAllocationBalanceResult = await pg.query(userAllocationBalanceQuery, [orgSettings.default_allocation_account, req.user.id, req.body.tfrom]);
            const userAllocationBalance = userAllocationBalanceResult.rows[0].balance;

            if (userAllocationBalance < req.body.amountpaid) {
                await pg.query('ROLLBACK');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Insufficient funds available at ${req.body.tfrom} allocation to the you. Contact your administrator for more funds to be allocated or pay ${userAllocationBalance} and pay the balance later`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });  
            }
            
            // debit the supplier account
            const supplierTransaction = {
                accountnumber: `${orgSettings.personal_account_prefix}${supplier.contactpersonphone}`,
                credit: 0,
                debit: totalValue,
                reference: req.body.paymentref,
                transactiondate: new Date(),
                transactiondesc: '',
                currency: supplier.currency,
                description: "Cost of items received from supplier",
                branch: null,
                registrationpoint: null,
                ttype: 'DEBIT',
                tfrom: tfrom,
                tax: false,
                voucher: req.body.voucher,
            };

            const debitSupplier = await performTransactionOneWay(supplierTransaction);

            if (!debitSupplier) {
                await pg.query('ROLLBACK');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: 'Failed to debit supplier account.',
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            // SUBMIT TRANSACTION PAID
            const fromTransaction = {
                accountnumber: `${orgSettings.default_allocation_account}`,
                credit: 0,
                debit: req.body.amountpaid,
                reference: req.body.paymentref,
                transactiondate: new Date(),
                transactiondesc: '',
                currency: supplier.currency,
                description: `Debit for items received to inventory from ${supplier.supplier}`,
                branch: null,
                registrationpoint: null,
                ttype: 'DEBIT',
                tfrom: tfrom,
                tax: false,
                voucher: req.body.voucher,
            };

            const toTransaction = {
                accountnumber: `${orgSettings.personal_account_prefix}${supplier.contactpersonphone}`,
                credit: req.body.amountpaid,
                debit: 0,
                reference:"",
                transactiondate: new Date(),
                transactiondesc: '', 
                currency: supplier.currency,
                description: `Credit for items purchased by ${user.firstname} ${user.lastname} to balance ${(Number(totalValue) - Number(req.body.amountpaid)).toLocaleString()}`,
                branch: null,
                registrationpoint: null,
                ttype: 'CREDIT',
                tfrom: tfrom,
                tax: false,
                voucher: req.body.voucher,
            };

            const makepayment = await performTransaction(fromTransaction, toTransaction, user.id, user.id);

            if (reference) {
                try {
                    await pg.query(
                        `DELETE FROM sky."Inventory" WHERE reference = $1`,
                        [reference]
                    );
                } catch (error) {
                    console.error('Error deleting purchase order:', error); 
                    await pg.query('ROLLBACK');
                    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                        status: false,
                        message: "Failed to delete purchase order",
                        statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                        data: null,
                        errors: []
                    });
                }
            }

            if (makepayment) {
                await pg.query('COMMIT');
                // Return success response with the inserted inventory items
                return res.status(StatusCodes.OK).json({
                    status: true,
                    message: "Inventory Received successfully",
                    statuscode: StatusCodes.OK,
                    data: inventoryItems,
                    errors: []
                });
            } else {
                await pg.query('ROLLBACK');
                // Return failure response if payment was not successful
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Failed to add opening stock due to payment issue",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        } catch (error) {
            await pg.query('ROLLBACK');
            console.error('Transaction error:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Transaction failed",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: []
            });
        }
    } catch (error) {
        // Log error if any occurs
        console.error(error);
        // Return error response if an internal server error occurs
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR, 
            data: '',
            errors: []  
        });
    }
};

// Export the manageReceivePurchases function
module.exports = {manageReceivePurchases};