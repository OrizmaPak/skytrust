const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const pg = require("../../../db/pg"); // Import PostgreSQL client
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware for activity tracking

// Function to handle POST request for creating inventory
const createInventory = async (req, res) => {
    const user = req.user;
    // Extract required fields from the request body
    const { rowsize, branch=user.branch, ...body } = req.body;
    console.log(rowsize, isNaN(rowsize), Number(rowsize) <= 0)
    // Validate rowsize
    if (isNaN(rowsize) || Number(rowsize) <= 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid rowsize. Rows size must be a positive number.",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Invalid rowsize"]
        });
    }

    // Extract fields dynamically based on rowsize
    const requiredFields = ['itemname', 'units', 'applyto', 'itemclass', 'composite'];
    const missingFields = requiredFields.filter(field => {
        for (let i = 1; i <= rowsize; i++) {
            if (!body[`${field}${i}`]) {
                return true;
            }
        }
        return false;
    });
    if (missingFields.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: missingFields.map(field => `Missing required field: ${field}`)
        });
    }
    // Validate and process each inventory item
    try {
        for (let i = 1; i <= rowsize; i++) {
            const itemname = body[`itemname${i}`]; // itemname
            const department = body[`department${i}`]; // department
            const branch = body[`branch${i}`]; // branch
            const units = body[`units${i}`]; // units
            const cost = body[`cost${i}`] || 0; // cost or use 0 if not found
            const applyto = body[`applyto${i}`]; // applyto
            const itemclass = body[`itemclass${i}`]; // itemclass
            const composite = body[`composite${i}`] || "NO"; // composite, default to NO if not provided
            const price = body[`price${i}`] || 0; // price or use 0 if not found
            const pricetwo = body[`pricetwo${i}`] || 0; // pricetwo or use 0 if not found
            const beginbalance = body[`beginbalance${i}`] || 0; // beginbalance or use 0 if not found
            const qty = body[`qty${i}`] || 0; // qty or use 0 if not found
            const minimumbalance = body[`minimumbalance${i}`] || 0; // minimumbalance or use 0 if not found
            const group = body[`group${i}`] || ''; // group or use 0 if not found
            const description = body[`description${i}`] || ''; // description or use 0 if not found
            const reorderlevel = body[`reorderlevel${i}`] || ''; // reorderlevel or use 0 if not found

            // Validate units
            const validUnits = ["PCS", "YARDS", "KG", "SETS", "METRES", "LITRES"];
            if (!validUnits.includes(units)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `The unit provided (${units}) is not valid. Please use one of the following valid units: ${validUnits.join(", ")}.`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["Invalid unit"]
                });
            }
            // Validate applyto
            const validApplyTo = ["FOR SALES", "NOT FOR SALES"];
            if (!validApplyTo.includes(applyto)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `The 'applyto' value provided (${applyto}) is not valid. Please use one of the following valid options: ${validApplyTo.join(", ")}.`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["Invalid applyto"]
                });
            }
            // Validate itemclass
            const validItemClass = ["STOCK-ITEM", "NON STOCK-ITEM"];
            if (!validItemClass.includes(itemclass)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `The 'itemclass' value provided (${itemclass}) is not valid. Please use one of the following valid options: ${validItemClass.join(", ")}.`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["Invalid itemclass"]
                });
            }
            // Validate composite
            const validComposite = ["YES", "NO"];
            if (!validComposite.includes(composite)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `The 'composite' value provided (${composite}) is not valid. Please use one of the following valid options: ${validComposite.join(", ")}.`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["Invalid composite"]
                });
            }
            // Split branch string into an array if it contains '||'
            const branches = branch && branch.includes('||') ? branch.split('||') : [branch];

            for (let br of branches) {
                // Check if each branch exists
                // const { rows: branchExists } = await pg.query(`SELECT * FROM skyeu."Branch" WHERE id = $1`, [br]);
                // if (branchExists.length === 0) {
                //     return res.status(StatusCodes.BAD_REQUEST).json({
                //         status: false,
                //         message: `Branch with id ${br} does not exist`,
                //         statuscode: StatusCodes.BAD_REQUEST,
                //         data: null,
                //         errors: [`Branch with id ${br} does not exist`]
                //     });
                // }

                // WE DONT NEED TO CHECK IF THE BRANCH EXIST SINCE WE ARE ALREADY CHECKING IF THE DEPARTMENT EXIST

                // Check if itemname exists for each branch
                const { rows: itemExists } = await pg.query(`SELECT * FROM skyeu."Inventory" WHERE itemname = $1 AND branch = $2`, [itemname, br]);
                if (itemExists.length > 0) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: `Item already exists for the branch with id ${br}`,
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: [`Item already exists for the branch with id ${br}`]
                    });
                }
            }
            // Generate itemid
            const { rows: items } = await pg.query(`SELECT itemid FROM skyeu."Inventory" ORDER BY itemid DESC LIMIT 1`);
            let itemid = items.length > 0 ? items[0].itemid + 1 : 1000001;
            // Validate and process department
            const departments = department && department.includes('||') ? department.split('||') : [department];
            const beginbalances = beginbalance && beginbalance.includes('||') ? beginbalance.split('||') : [beginbalance];
            for (let i = 0; i < departments.length; i++) {
                const dept = departments[i];
                const beginbal = beginbalances[i];
                const brnch = branches[i];
                if (!dept) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: "Department cannot be empty",
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: ["Department cannot be empty"]
                    });
                }
                const { rows: deptExists } = await pg.query(`SELECT * FROM skyeu."Department" WHERE id = $1`, [dept]);
                if (deptExists.length === 0) { 
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        status: false,
                        message: "Department does not exist",
                        statuscode: StatusCodes.BAD_REQUEST,
                        data: null,
                        errors: ["Department does not exist"]
                    });
                }
                // Save the item for each department
                const reference = new Date().getTime().toString(); // Generate reference number based on datetime
                const transactionDate = new Date(); // Set transaction date to the current date
                const departmentQty = i === 0 ? beginbalance : qty; // First department gets beginbalance as qty
                await pg.query(`INSERT INTO skyeu."Inventory" (itemid, itemname, department, branch, units, cost, applyto, itemclass, composite, price, pricetwo, beginbalance, qty, minimumbalance, "group", description, imageone, imagetwo, imagethree, status, "reference", transactiondate, transactiondesc, reorderlevel, dateadded, createdby) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`, 
                    [itemid, itemname, dept, brnch, units, cost, applyto, itemclass, composite, price, pricetwo, beginbal, beginbal, minimumbalance, group, description, null, null, null, "ACTIVE", reference, transactionDate, "Creation with opening stock", reorderlevel, new Date(), req.user.id]);
            }
        }
        await activityMiddleware(req, req.user.id, 'Inventory created successfully', 'INVENTORY'); // Tracker middleware
        return res.status(StatusCodes.CREATED).json({
            status: true,
            message: "Inventory created successfully",
            statuscode: StatusCodes.CREATED,
            errors: []
        });
    } catch (error) {
        console.error(error);
        await activityMiddleware(req, req.user.id, 'An unexpected error occurred while creating inventory', 'INVENTORY'); // Tracker middleware
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: ["An unexpected error occurred while creating inventory"]
        });
    }
}

module.exports = {
    createInventory
};