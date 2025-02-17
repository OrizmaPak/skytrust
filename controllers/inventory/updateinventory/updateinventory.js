// Import necessary modules
const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

// Define the updateinventory function
const updateinventory = async (req, res) => {
    console.log('update inventory', req.files)
    if (req.files) {
        await uploadToGoogleDrive(req, res);
    }
    console.log('update inventory2')
    // Destructure the request body
    const { itemid, branch, department="", ...inventoryData } = req.body;

    // Check if itemid and branch are provided
    if (!itemid) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Itemid are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Itemid are required"]
        });
    }

    try {
        // Initialize departments array
        let departments = department && department.includes('||') ? department.split('||') : [department];
        if (!department) {
            const { rows: itemDepartments } = await pg.query(`SELECT department FROM sky."Inventory" WHERE itemid = $1 GROUP BY department`, [itemid]);
            departments = [...new Set(itemDepartments.map(d => d.department))];
        }
        // Fetch the department with the highest id for the itemid
        let { rows: maxIdDepartment } = await pg.query(`SELECT * FROM sky."Inventory" WHERE itemid = $1 ORDER BY id DESC LIMIT 1`, [itemid]);

        if(department){
            maxIdDepartment = await pg.query(`SELECT * FROM sky."Inventory" WHERE itemid = $1 AND department = $2`, [itemid, department]);
            maxIdDepartment = maxIdDepartment.rows;
        }

        
        // If department is not provided, fetch all departments for the itemid
        // if (!department) {
        //     const { rows: allDepartments } = await pg.query(`SELECT department FROM sky."Inventory" WHERE itemid = $1 GROUP BY department`, [itemid]);
        //     departments = allDepartments.map(d => d.department);
        // } 


        // DECLARING THE ITEM NAME CAUSE SOME PEOPLE MIGHT DECIDE TO CHANGE IT ACROSS DEPARTMENTS
        let itmn 

        // Initialize an array to store branches in the order of departments
        let branches = branch && branch.includes('||') ? branch.split('||') : [branch];; 

        // Iterate over each department and fetch the corresponding branch
        if(!branch)for (let dept of departments) {
            console.log('dept:', dept);
            const { rows } = await pg.query(`SELECT branch FROM sky."Department" WHERE id = $1`, [dept]);
            console.log('rows:', rows);
            if (rows.length > 0) {
                branches.push(rows[0].branch);
            } else {
                branches.push(null); // or handle the case where no branch is found for the department
            }
        }

        // console.log('Branches:', branches);
        // console.log('departments:', departments);
        // return;

        // Iterate over each department
        for (let i = 0; i < departments.length; i++) {
            // Construct the data object
            const data = { ...inventoryData, itemid, branch: branches[i], department: departments[i] };
            // If it's not the first department, fill in missing data with the max id data
            if (i > 0) {
                for (let key in maxIdDepartment[0]) {
                    if (!data[key]) {
                        data[key] = maxIdDepartment[0][key];
                    }
                }
            }
            // Override maxIdDepartment data with body data if provided
            for (let key in maxIdDepartment[0]) {
                if (inventoryData[key] !== undefined) {
                    data[key] = inventoryData[key];
                } else {
                    data[key] = maxIdDepartment[0][key];
                }
            }
 
            // Ensure image fields use database values if not provided
            const imageFields = ['imageone', 'imagetwo', 'imagethree'];
            imageFields.forEach(field => {
                if (data[field] == "") {
                    console.log('image', data[field]);
                    data[field] = maxIdDepartment[0][field];
                }
            });

            itmn = data.itemname;

            // Insert the data into the Inventory table
            await pg.query(`INSERT INTO sky."Inventory" (itemid, branch, department, itemname, units, cost, price, pricetwo, beginbalance, qty, minimumbalance, "group", applyto, itemclass, composite, compositeid, description, imageone, imagetwo, imagethree, status, "reference", transactiondate, transactiondesc, dateadded, createdby) 
                                                    VALUES ($1,     $2,     $3,         $4,       $5,    $6,   $7,    $8,       $9,           $10, $11,            $12,     $13,     $14,       $15,       $16,         $17,         $18,      $19,      $20,        $21,    $22,         $23,             $24,             $25,       $26)`, 
                                                    [data.itemid, data.branch, data.department, data.itemname, data.units, data.cost, data.price, data.pricetwo, data.beginbalance, 0, data.minimumbalance, data.group, data.applyto, data.itemclass, data.composite, data.compositeid, data.description, data.imageone, data.imagetwo, data.imagethree, data.status, new Date().getTime().toString(), new Date, 'Update details of the item', new Date(), req.user.id]);
        }

        // Log activity
        if (branch) {
            const { rows: branchName } = await pg.query(`SELECT branch FROM sky."Branch" WHERE id = $1`, [branch]);
            await activityMiddleware(res, req.user.id, `Inventory for item ${itmn} in branch ${branchName[0].branch} updated successfully`, 'UPDATE_INVENTORY');
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
            errors: []
        });
    }
};

// Export the updateinventory function
module.exports = { updateinventory };
