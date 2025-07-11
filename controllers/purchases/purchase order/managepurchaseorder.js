// Import required modules
const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { v4: uuidv4 } = require('uuid');
const { activityMiddleware } = require("../../../middleware/activity");

// Function to handle opening stock request for multiple items
const managePurchaseOrder = async (req, res) => {
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

    const reference = req.body.transactionref;

    // Extract user from request
    const user = req.user;

    try {
        // Initialize an array to hold all the inventory items to be inserted
        const inventoryItems = [];

        if(reference){  
            await pg.query(
                `DELETE FROM skyeu."Inventory" WHERE transactionref = $1`,
                [reference]
            );
        };

        const refinstance = new Date().getTime().toString();

        // Loop through each item based on rowsize
        for (let i = 1; i <= rowsize; i++) {
            // Extract id from request body
            const itemid = req.body[`itemid${i}`];
            // Query to select inventory item by itemid
            const inventory = await pg.query(`SELECT * FROM skyeu."Inventory" WHERE itemid = $1`, [itemid]);
 
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

            // Update cloned inventory properties with request body values if provided
            clonedInventory.qty = req.body[`qty${i}`] || clonedInventory.qty;
            clonedInventory.cost = req.body[`cost${i}`] || clonedInventory.cost;
            clonedInventory.department = req.body[`department`] || clonedInventory.department;
            clonedInventory.branch = req.body[`branch`] || clonedInventory.branch;
            clonedInventory.transactiondate = req.body[`transactiondate${i}`] || new Date(); // Set transaction date to current date
            clonedInventory.transactiondesc = req.body[`transactiondesc${i}`] || ''; // Set transaction description
            clonedInventory.transactionref = !req.body[`transactionref`].length ? `PO-${refinstance}` : req.body[`transactionref`]; // Set transaction reference
            clonedInventory.supplier = req.body[`supplier`] || ''; // Set transaction description
            clonedInventory.reference = reference ? reference.split('||')[0] + '||' + req.body['supplier'] : `PO-${refinstance}||${req.body['supplier']}`;
            clonedInventory.createdby = user.id; // Set created by to the current user

            // Add the cloned inventory item to the array
            inventoryItems.push(clonedInventory);
        } 

        // Insert cloned inventory items into the database
        for (const item of inventoryItems) {
            await pg.query(`INSERT INTO skyeu."Inventory" (
                itemid, itemname, department, branch, units, cost, price, pricetwo, 
                beginbalance, qty, minimumbalance, "group", applyto, itemclass, 
                composite, compositeid, description, imageone, imagetwo, imagethree, 
                status, "reference", transactiondate, transactiondesc, transactionref, createdby, dateadded, supplier
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
            )`, [
                item.itemid, item.itemname, item.department, 
                item.branch, item.units, item.cost, 
                item.price, item.pricetwo, item.beginbalance, 
                item.qty, item.minimumbalance, item.group, 
                item.applyto, item.itemclass, item.composite, 
                item.compositeid, item.description, item.imageone, 
                item.imagetwo, item.imagethree, 'PO', 
                item.reference, item.transactiondate, item.transactiondesc, 
                item.transactionref, item.createdby, new Date(), item.supplier
            ]);

            // Log activity for opening stock
            // Get the department from the department table
            const { rows: department } = await pg.query(`SELECT department FROM skyeu."Department" WHERE id = $1`, [item.department]);
            // Get the branch from the branch table
            const { rows: branch } = await pg.query(`SELECT branch FROM skyeu."Branch" WHERE id = $1`, [item.branch]);
            // Log activity for opening stock
            await activityMiddleware(res, req.user.id, `Opening stock added for item ${item.itemname} in department ${department[0].department} and branch ${branch[0].branch} with quantity ${item.qty}`, 'OPEN STOCK');
        }

        // Return success response with the inserted inventory items
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Opening stock added successfully",
            statuscode: StatusCodes.OK,
            data: inventoryItems,
            errors: []  
        });
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

// Export the managePurchaseOrder function
module.exports = {managePurchaseOrder};

