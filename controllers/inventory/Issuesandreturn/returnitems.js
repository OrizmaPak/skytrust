// Import necessary modules
const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

// Define the managereturnitems function
const managereturnitems = async (req, res) => {
    // Destructure the request body
    const { branch, department, rowsize, reference, ...itemDetails } = req.body;

    // FOR UPDATE SEND REFERENCE 

    // Validate the presence of branch, department, and rowsize
    if (!branch || !department || !rowsize) {
        await activityMiddleware(res, req.user.id, 'Missing compulsory branch, department, or rowsize', 'RETURNED ITEMS');
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Branch, department, and rowsize are required for returning items",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Branch, department, and rowsize are required for returning items"]
        });
    }

    // Validate that the branch exists
    const branchExists = await pg.query(`SELECT * FROM skyeu."Branch" WHERE id = $1`, [branch]);
    if (branchExists.rows.length === 0) {
        await activityMiddleware(res, req.user.id, 'Branch does not exist, cannot return items', 'RETURNED ITEMS');
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Branch does not exist, cannot return items",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Branch does not exist, cannot return items"]
        });
    }

    // Validate that the department exists in the branch
    const departmentExists = await pg.query(`SELECT * FROM skyeu."Department" WHERE id = $1 AND branch = $2`, [department, branch]);
    if (departmentExists.rows.length === 0) {
        await activityMiddleware(res, req.user.id, 'Department does not exist in the branch, cannot return items', 'RETURNED ITEMS');
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Department does not exist in the branch, cannot return items",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Department does not exist in the branch, cannot return items"]
        });
    }

    // Validate that the supplier exists
    const supplierExists = await pg.query(`SELECT * FROM skyeu."Supplier" WHERE id = $1`, [itemDetails.supplier]);
    if (supplierExists.rows.length === 0) {
        await activityMiddleware(res, req.user.id, 'Supplier does not exist, cannot return items', 'RETURNED ITEMS');
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Supplier does not exist, cannot return items",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Supplier does not exist, cannot return items"]
        });
    }

    // Extract item details from the request body
    const itemids = [];
    const qtys = [];
    const suppliers = [];
    const issues = [];
    for (let i = 1; i <= rowsize; i++) {
        itemids.push(itemDetails[`itemid${i}`]);
        qtys.push(itemDetails[`qty${i}`]);
        suppliers.push(itemDetails[`supplier${i}`]);
        issues.push(itemDetails[`issue${i}`]);
    }

    // Validate the number of itemids, qtys, suppliers, and issues match the rowsize
    if (itemids.length != rowsize || qtys.length != rowsize || suppliers.length != rowsize || issues.length != rowsize) {
        await activityMiddleware(res, req.user.id, 'Number of itemids, qtys, suppliers, and issues must match the rowsize for returning items', 'RETURNED ITEMS');
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Number of itemids, qtys, suppliers, and issues must match the rowsize for returning items",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Number of itemids, qtys, suppliers, and issues must match the rowsize for returning items"]
        });
    }

    try {
        // Start a transaction
        await pg.query('BEGIN');

        // DECLARING THE REFERENCE IF ITS CREATION
        const ref = new Date().getTime().toString()

        // Process each item
        for (let i = 0; i < rowsize; i++) {
            // Validate that the itemid exists in the department of the branch
            const itemExists = await pg.query(`SELECT * FROM skyeu."Inventory" WHERE itemid = $1 AND department = $2 AND branch = $3 AND status = 'ACTIVE'`, [itemids[i], department, branch]);
            if (itemExists.rows.length === 0) {
                await pg.query('ROLLBACK');
                // await pg.end(); // Close the transaction
                await activityMiddleware(res, req.user.id, `Item ${itemids[i]} does not exist in the department of the branch, cannot return`, 'RETURNED ITEMS');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Item ${itemids[i]} does not exist in the department of the branch, cannot return`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: [`Item ${itemids[i]} does not exist in the department of the branch, cannot return`]
                });
            }

            // Check if qty is not 0
            if (qtys[i] === 0) {
                await pg.query('ROLLBACK');
                // await pg.end(); // Close the transaction
                await activityMiddleware(res, req.user.id, `Qty for item ${itemids[i]} cannot be 0 for returning`, 'RETURNED ITEMS');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Qty for item ${itemids[i]} cannot be 0 for returning`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: [`Qty for item ${itemids[i]} cannot be 0 for returning`]
                });
            }

            // Calculate the total quantity available for the item
            const totalQtyAvailable = itemExists.rows.reduce((acc, curr) => acc + curr.qty, 0);

            // Check if the requested qty is greater than the available stock
            if (qtys[i] > totalQtyAvailable) {
                await pg.query('ROLLBACK');
                // await pg.end(); // Close the transaction
                await activityMiddleware(res, req.user.id, `Qty ${qtys[i]} for item ${itemids[i]} is greater than available stock for returning`, 'RETURNED ITEMS');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Qty ${qtys[i]} for item ${itemids[i]} is greater than available stock for returning`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: [`Qty ${qtys[i]} for item ${itemids[i]} is greater than available stock for returning`]
                });
            }

            // Check if the quantity is more than the qty that has issues
            const qtyWithIssues = await pg.query(`SELECT SUM(qty) FROM skyeu."Inventory" WHERE itemid = $1 AND department = $2 AND branch = $3 AND status = 'ACTIVE' AND transactiondesc LIKE '%Issue%'`, [itemids[i], department, branch]);
            if (qtyWithIssues.rows[0].sum && qtys[i] > qtyWithIssues.rows[0].sum) {
                await pg.query('ROLLBACK');
                // await pg.end(); // Close the transaction
                await activityMiddleware(res, req.user.id, `Qty ${qtys[i]} for item ${itemids[i]} is greater than the qty that has issues for returning`, 'RETURNED ITEMS');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Qty ${qtys[i]} for item ${itemids[i]} is greater than the qty that has issues for returning`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: [`Qty ${qtys[i]} for item ${itemids[i]} is greater than the qty that has issues for returning`]
                });
            }

            // Construct the data object with fallback values
            const fallbackData = {
                itemid: itemids[i],
                branch,
                department,
                qty: -qtys[i],
                status: "ACTIVE",
                transactiondesc: "RETURNED ITEMS",
                dateadded: new Date(),
                createdby: req.user.id,
                itemname: itemExists.rows[0].itemname,
                units: itemExists.rows[0].units,
                cost: itemExists.rows[0].cost,
                price: itemExists.rows[0].price,
                pricetwo: itemExists.rows[0].pricetwo,
                beginbalance: itemExists.rows[0].beginbalance,
                minimumbalance: itemExists.rows[0].minimumbalance,
                group: itemExists.rows[0].group,
                applyto: itemExists.rows[0].applyto,
                itemclass: itemExists.rows[0].itemclass,
                composite: itemExists.rows[0].composite,
                compositeid: itemExists.rows[0].compositeid,
                description: itemExists.rows[0].description,
                imageone: itemExists.rows[0].imageone,
                imagetwo: itemExists.rows[0].imagetwo,
                imagethree: itemExists.rows[0].imagethree,
                sellingprice: 0,
                reference: reference || ref, // If reference is not provided, generate a new one
                transactiondate: new Date(),
                issue: itemExists.rows[0].issues,
                issuetype: itemExists.rows[0].issueTypes,
                supplier: suppliers[i]
            };

            // If reference is provided, delete all inventory with that reference
            if (reference) {
                await pg.query(`DELETE FROM skyeu."Inventory" WHERE reference = $1`, [reference]);
            }

            // Insert the data into the Inventory table
            await pg.query(`INSERT INTO skyeu."Inventory" (itemid, branch, department, qty, status, transactiondesc, dateadded, createdby, itemname, units, cost, price, pricetwo, beginbalance, minimumbalance, "group", applyto, itemclass, composite, compositeid, description, imageone, imagetwo, imagethree, sellingprice, reference, transactiondate, issue, issuetype, supplier) 
                                             VALUES ($1,     $2,     $3,       $4,     $5,     $6,             $7,       $8,       $9,       $10,    $11,   $12,    $13,       $14,       $15,     $16,     $17,       $18,       $19,       $20,       $21,       $22,       $23,       $24,       $25,       $26,       $27,  $28, $29, $30)`, 
                                            [fallbackData.itemid, fallbackData.branch, fallbackData.department, fallbackData.qty, fallbackData.status, fallbackData.transactiondesc, fallbackData.dateadded, fallbackData.createdby, fallbackData.itemname, fallbackData.units, fallbackData.cost, fallbackData.price, fallbackData.pricetwo, fallbackData.beginbalance, fallbackData.minimumbalance, fallbackData.group, fallbackData.applyto, fallbackData.itemclass, fallbackData.composite, fallbackData.compositeid, fallbackData.description, fallbackData.imageone, fallbackData.imagetwo, fallbackData.imagethree, fallbackData.sellingprice, fallbackData.reference, fallbackData.transactiondate, fallbackData.issue, fallbackData.issuetype, fallbackData.supplier]);

            // Log activity
            await activityMiddleware(res, req.user.id, `Inventory for item ${fallbackData.itemid} name ${fallbackData.itemname} in branch ${branch} updated successfully for return`, 'RETURNED ITEMS');
        }

        // Commit the transaction
        await pg.query('COMMIT');
        // await pg.end(); // Close the transaction

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Inventory saved successfully for return",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        }); 
    } catch (error) {
        // Log and return error response
        console.error(error);
        await pg.query('ROLLBACK');
        // await pg.end(); // Close the transaction
        await activityMiddleware(res, req.user.id, 'An unexpected error occurred while managing return items', 'RETURNED ITEMS');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

// Export the managereturnitems function
module.exports = { managereturnitems };