// Import necessary modules
const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

// Helper function to fetch fallback data
const getFallbackData = async (itemid, department) => {
    if (!department) return {};

    const fallbackResult = await pg.query(
        `SELECT * FROM sky."Inventory" WHERE itemid = $1 AND department = $2 ORDER BY id DESC LIMIT 1`, 
        [itemid, department]
    );
    return fallbackResult.rows[0] || {};
};

// Define the updatemultipleinventory function
const updatemultipleinventory = async (req, res) => {
    console.log('update inventory', req.files);

    // Handle file uploads if any
    if (req.files) {
        await uploadToGoogleDrive(req, res); 
    }
    console.log('update inventory2');

    // Destructure the request body
    const { rowsize, ...body } = req.body;

    // Validate rowsize
    const totalItems = parseInt(rowsize, 10);
    if (isNaN(totalItems) || totalItems < 1) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Valid rowsize is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Valid rowsize is required"]
        });
    }

    try {
        // Initialize arrays to store item data
        const items = [];

        for (let i = 1; i <= totalItems; i++) {
            // Extract fields for the current item with fallback
            const item = {
                itemid: body[`itemid${i}`],
                branch: body[`branch${i}`],
                department: body[`department${i}`],
                itemname: body[`itemname${i}`],
                units: parseInt(body[`units${i}`], 10),
                cost: parseFloat(body[`cost${i}`]),
                price: parseFloat(body[`price${i}`]),
                pricetwo: parseFloat(body[`pricetwo${i}`]),
                beginbalance: parseFloat(body[`beginbalance${i}`]),
                minimumbalance: parseFloat(body[`minimumbalance${i}`]),
                group: body[`group${i}`],
                applyto: body[`applyto${i}`],
                itemclass: body[`itemclass${i}`],
                composite: body[`composite${i}`] === 'true',
                compositeid: body[`compositeid${i}`],
                description: body[`description${i}`],
                imageone: body[`imageone${i}`],
                imagetwo: body[`imagetwo${i}`],
                imagethree: body[`imagethree${i}`],
                status: body[`status${i}`],
            };

            // Validate required fields
            if (!item.itemid) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Itemid${i} is required`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: [`Itemid${i} is required`]
                });
            }

            // Fetch fallback data
            const fallbackData = await getFallbackData(item.itemid, item.department);
            for (const key in fallbackData) {
                if (item[key] === undefined || item[key] === null || item[key] === "") {
                    item[key] = fallbackData[key];
                }
            }

            items.push(item);
        }

        // Process each item
        for (const [index, item] of items.entries()) {
            const { itemid, branch, department, ...inventoryData } = item;

            // Initialize departments array
            let departments = department.includes('||') ? department.split('||') : [department];
            if (!department) {
                const { rows: itemDepartments } = await pg.query(
                    `SELECT department FROM sky."Inventory" WHERE itemid = $1 GROUP BY department`,
                    [itemid]
                );
                departments = [...new Set(itemDepartments.map(d => d.department))];
            }

            // Initialize branches array
            let branches = branch && branch.includes('||') ? branch.split('||') : [branch];

            // If branch is not provided, fetch branches based on departments
            if (!branch) {
                for (let dept of departments) {
                    console.log('dept:', dept);
                    const { rows } = await pg.query(
                        `SELECT branch FROM sky."Department" WHERE id = $1`,
                        [dept]
                    );
                    console.log('rows:', rows);
                    if (rows.length > 0) {
                        branches.push(rows[0].branch);
                    } else {
                        branches.push(null); // Handle case where no branch is found
                    }
                }
            }

            // Iterate over each department and insert inventory data
            for (let i = 0; i < departments.length; i++) {
                // Construct the data object
                const data = {
                    ...inventoryData,
                    itemid,
                    branch: branches[i],
                    department: departments[i]
                };

                // Fetch fallback data for the current branch and department
                const currentFallback = await getFallbackData(itemid, departments[i]);

                // return console.log('currentFallback:', currentFallback);

                // Fill in missing fields with fallback data
                for (const key in currentFallback) {
                    if (!data[key] && key !== 'beginbalance' && key !== 'qty') {
                        data[key] = currentFallback[key]; 
                    }else if(!data[key] && key === 'beginbalance'){
                        data[key] = 0;
                    }else if(!data[key] && key === 'qty'){
                        data[key] = 0;
                    }
                }


                // Insert the data into the Inventory table
                await pg.query(
                    `INSERT INTO sky."Inventory" (
                        itemid, branch, department, itemname, units, cost, price, pricetwo, 
                        beginbalance, qty, minimumbalance, "group", applyto, itemclass, 
                        composite, compositeid, description, imageone, imagetwo, imagethree, 
                        status, "reference", transactiondate, transactiondesc, dateadded, createdby
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, 
                        $9, $10, $11, $12, $13, $14, 
                        $15, $16, $17, $18, $19, $20, 
                        $21, $22, $23, $24, $25, $26
                    )`,
                    [
                        data.itemid,
                        data.branch,
                        data.department,
                        data.itemname,
                        data.units,
                        data.cost,
                        data.price,
                        data.pricetwo,
                        data.beginbalance,
                        data.beginbalance,
                        data.minimumbalance,
                        data.group,
                        data.applyto,
                        data.itemclass,
                        data.composite,
                        data.compositeid,
                        data.description,
                        data.imageone,
                        data.imagetwo,
                        data.imagethree,
                        data.status,
                        new Date().getTime().toString(),
                        new Date(),
                        `Update details of the item ${data.itemid}`,
                        new Date(),
                        req.user.id
                    ]
                );
            }
        }

        // Log activity for all items
        for (const item of items) {
            const { itemid, branch } = item;
            const { rows: branchName } = await pg.query(
                `SELECT branch FROM sky."Branch" WHERE id = $1`,
                [branch]
            );
            const branchDisplayName = branchName.length > 0 ? branchName[0].branch : "Unknown Branch";
            await activityMiddleware(
                res,
                req.user.id,
                `Inventory for item ${item.itemname} in branch ${branchDisplayName} updated successfully`,
                'UPDATE_INVENTORY'
            );
        }

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Inventory saved successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        // Log and return error response
        console.error(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message || "An error occurred"]
        });
    }
};

// Export the updatemultipleinventory function
module.exports = { updatemultipleinventory };
