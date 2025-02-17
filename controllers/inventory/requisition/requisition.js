const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const requisition = async (req, res) => {
    const { branchfrom, branchto, description, transactiondate, departmentfrom, departmentto, rowsize, ...inventoryData } = req.body;
    const uniformReference = new Date().getTime().toString();

    // Validate required fields
    if (!branchfrom || !branchto || !departmentfrom || !departmentto || !rowsize) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "branchfrom, branchto, departmentfrom, departmentto, and rowsize are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["branchfrom, branchto, departmentfrom, departmentto, and rowsize are required"]
        });
    }

    // Detailed validation for branch existence
    const { rows: branchFromRows } = await pg.query(`SELECT * FROM sky."Branch" WHERE id = $1`, [branchfrom]);
    if (branchFromRows.length === 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Branch ${branchfrom} does not exist`,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: [`Branch ${branchfrom} does not exist`]
        });
    }

    const { rows: branchToRows } = await pg.query(`SELECT * FROM sky."Branch" WHERE id = $1`, [branchto]);
    if (branchToRows.length === 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Branch ${branchto} does not exist`,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: [`Branch ${branchto} does not exist`]
        });
    }

    // Detailed validation for department existence in their respective branches
    const { rows: departmentFromRows } = await pg.query(`SELECT * FROM sky."Department" WHERE id = $1 AND branch = $2`, [departmentfrom, branchfrom]);
    if (departmentFromRows.length === 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Department ${departmentfrom} does not exist in branch ${branchfrom}`,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: [`Department ${departmentfrom} does not exist in branch ${branchfrom}`]
        });
    }

    const { rows: departmentToRows } = await pg.query(`SELECT * FROM sky."Department" WHERE id = $1 AND branch = $2`, [departmentto, branchto]);
    if (departmentToRows.length === 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: `Department ${departmentto} does not exist in branch ${branchto}`,
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: [`Department ${departmentto} does not exist in branch ${branchto}`]
        });
    }

    // Extract itemids, qtys, and prices from the request body
    const itemids = [];
    const qtys = [];
    const prices = [];
    const descriptions = [];
    const transactiondates = [];
    for (let i = 1; i <= rowsize; i++) {
        const itemIdKey = `itemid${i}`;
        const qtyKey = `qty${i}`;
        const priceKey = `price${i}`;
        const requiredFields = [itemIdKey, qtyKey, priceKey];
        const missingFields = requiredFields.filter(field => !inventoryData[field]);
        if (missingFields.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `${missingFields.join(', ')} are required`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: [`${missingFields.join(', ')} are required`]
            });
        }
        itemids.push(inventoryData[itemIdKey]);
        qtys.push(inventoryData[qtyKey]);
        prices.push(inventoryData[priceKey]);
        descriptions.push(inventoryData[description]);
        transactiondates.push(inventoryData[transactiondate]);
    }

    try {
        // Check if the quantity requested is greater than available stock for each itemid
        for (let i = 0; i < itemids.length; i++) {
            const { rows: inventoryRows } = await pg.query(`SELECT SUM(qty) AS totalQty FROM sky."Inventory" WHERE itemid = $1 AND branch = $2 AND department = $3`, [itemids[i], branchfrom, departmentfrom]);
            console.log('inventoryRows:', inventoryRows, itemids[i], branchfrom, departmentfrom);
            const totalQty = inventoryRows[0].totalqty??0;
            if (qtys[i] > totalQty) {
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

        // Process each itemid
        for (let i = 0; i < itemids.length; i++) {
            // Fetch fallback data for branchfrom and departmentfrom
            const { rows: fallbackRowsFrom } = await pg.query(`SELECT * FROM sky."Inventory" WHERE itemid = $1 AND branch = $2 AND department = $3 ORDER BY id DESC LIMIT 1`, [itemids[i], branchfrom, departmentfrom]);
            const fallbackDataFrom = fallbackRowsFrom.length > 0 ? fallbackRowsFrom[0] : {};

            // Update the qty to negative in branchfrom and departmentfrom
            const { rowCount: insertResult } = await pg.query(`INSERT INTO sky."Inventory" (itemid, itemname, department, branch, units, cost, price, pricetwo, beginbalance, qty, minimumbalance, "group", applyto, itemclass, composite, compositeid, description, imageone, imagetwo, imagethree, status, "reference", transactiondate, transactiondesc, dateadded, createdby, sellingprice) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`, [itemids[i], fallbackDataFrom.itemname, departmentfrom, branchfrom, fallbackDataFrom.units, fallbackDataFrom.cost, fallbackDataFrom.price, fallbackDataFrom.pricetwo, fallbackDataFrom.beginbalance, -qtys[i], fallbackDataFrom.minimumbalance, fallbackDataFrom.group, fallbackDataFrom.applyto, fallbackDataFrom.itemclass, fallbackDataFrom.composite, fallbackDataFrom.compositeid, fallbackDataFrom.description, fallbackDataFrom.imageone, fallbackDataFrom.imagetwo, fallbackDataFrom.imagethree, 'ACTIVE', uniformReference, transactiondates[i]??new Date(), 'Requisition to departmentto in branchto'+'||'+descriptions[i], new Date(), req.user.id, prices[i]]);
            if (insertResult === 0) {
                // Log activity for failed requisition
                await activityMiddleware(res, req.user.id, `Failed requisition for itemid ${itemids[i]}`, 'FAILED REQUISITION');
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                    status: false,
                    message: "Something went wrong",
                    statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                    data: null,
                    errors: ["Something went wrong"]
                });
            }
            // Fetch fallback data for branchto and departmentto
            const { rows: fallbackRowsTo } = await pg.query(`SELECT * FROM sky."Inventory" WHERE itemid = $1 AND branch = $2 AND department = $3 ORDER BY id DESC LIMIT 1`, [itemids[i], branchto, departmentto]);
            const fallbackDataTo = fallbackRowsTo.length > 0 ? fallbackRowsTo[0] : fallbackDataFrom; // Use fallbackDataFrom if fallbackRowsTo is empty

            // Insert or update the qty to positive in branchto and departmentto
            const result = await pg.query(`INSERT INTO sky."Inventory" (itemid, itemname, department, branch, units, cost, price, pricetwo, beginbalance, qty, minimumbalance, "group", applyto, itemclass, composite, compositeid, description, imageone, imagetwo, imagethree, status, "reference", transactiondate, transactiondesc, dateadded, createdby, sellingprice) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27) RETURNING *`, [itemids[i], fallbackDataTo.itemname, departmentto, branchto, fallbackDataTo.units, prices[i], fallbackDataTo.price, fallbackDataTo.pricetwo, fallbackDataTo.beginbalance, qtys[i], fallbackDataTo.minimumbalance, fallbackDataTo.group, fallbackDataTo.applyto, fallbackDataTo.itemclass, fallbackDataTo.composite, fallbackDataTo.compositeid, fallbackDataTo.description, fallbackDataTo.imageone, fallbackDataTo.imagetwo, fallbackDataTo.imagethree, 'PENDING REQUISITION', uniformReference, transactiondates[i]??new Date(), 'Requisition from departmentfrom in branchfrom'+'||'+descriptions[i], new Date(), req.user.id, prices[i]]);
            if (result.rowCount === 0) {
                console.error(`Failed to insert inventory for itemid ${itemids[i]} in branchto and departmentto`);
                // Log activity for failed requisition
                await activityMiddleware(res, req.user.id, `Failed requisition for itemid ${itemids[i]}`, 'FAILED REQUISITION');
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                    status: false,
                    message: `Failed to insert inventory for itemid ${itemids[i]} in branchto and departmentto`,
                    statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                    data: null,
                    errors: [`Failed to insert inventory for itemid ${itemids[i]} in branchto and departmentto`]
                });
            }
        }

        // Log activity for requisition
        await activityMiddleware(res, req.user.id, `Requisition processed for branchfrom ${branchfrom} to branchto ${branchto}`, 'REQUISITION PROCESSED');

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Requisition processed successfully",
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

module.exports = { requisition };



