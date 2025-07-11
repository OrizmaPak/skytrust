const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { performTransactionOneWay } = require("../../../middleware/transactions/performTransaction");

const updateReturnItem = async (req, res) => {
    const { id, status, supplier, qty, cost, issue, staff, itemname } = req.body;

    const user = req.user;

    // Validate the presence of id, status, and either supplier or staff
    if (!id || !status || (!supplier && !staff)) {
        await activityMiddleware(res, req.user.id, 'Missing compulsory id, status, supplier, or staff', 'UPDATE_RETURN_ITEM');
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "ID, status, and either supplier or staff are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["ID, status, and either supplier or staff are required"]
        });
    }

    try {
        // Check if the item exists in the inventory
        const { rows: itemExists } = await pg.query(`SELECT * FROM skyeu."Inventory" WHERE id = $1 AND status = 'ACTIVE'`, [id]);
        if (itemExists.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Item not found in the inventory",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Item not found in the inventory"]
            });
        }

        let transactionEntity, transactionEntityType;

        if (supplier) {
            // Check if the supplier exists in the database
            const { rows: [supplierExists] } = await pg.query(`SELECT * FROM skyeu."Supplier" WHERE id = $1`, [supplier]);
            if (!supplierExists) {
                await activityMiddleware(res, req.user.id, 'Supplier does not exist, cannot update return item', 'UPDATE_RETURN_ITEM');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Supplier does not exist, cannot update return item",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["Supplier does not exist, cannot update return item"]
                });
            }
            transactionEntity = supplierExists;
            transactionEntityType = 'supplier';
        } else {
            // Check if the staff exists in the user table
            const { rows: [staffExists] } = await pg.query(`SELECT * FROM skyeu."User" WHERE id = $1`, [staff]);
            if (!staffExists) {
                await activityMiddleware(res, req.user.id, 'Staff does not exist, cannot update return item', 'UPDATE_RETURN_ITEM');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Staff does not exist, cannot update return item",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: ["Staff does not exist, cannot update return item"]
                });
            }
            transactionEntity = staffExists;
            transactionEntityType = 'staff';
        }

        // Get the contact person phone or user phone
        const contactPersonPhone = transactionEntityType === 'supplier' ? transactionEntity.contactpersonphone : transactionEntity.phone;
        if (!contactPersonPhone) {
            await activityMiddleware(res, req.user.id, `${transactionEntityType} contact person phone is missing`, 'UPDATE_RETURN_ITEM');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `${transactionEntityType} contact person phone is missing`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: [`${transactionEntityType} contact person phone is missing`]
            });
        }

        // Get the organisation setting data
        const { rows: [organisationSettings] } = await pg.query(`SELECT * FROM skyeu."Organisationsettings"`);
        if (!organisationSettings) {
            await activityMiddleware(res, req.user.id, 'Organisation settings not found', 'UPDATE_RETURN_ITEM');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Organisation settings not found",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["Organisation settings not found"]
            });
        }

        const totalValue = Math.abs(Number(qty) * Number(cost));

        await pg.query('BEGIN');

        // return console.log(contactPersonPhone)

        const transaction = {
            accountnumber: `${organisationSettings.personal_account_prefix}${contactPersonPhone}`,
            credit: staff?0:totalValue,
            debit: staff?totalValue:0,
            reference: "",
            transactiondate: new Date(),
            transactiondesc: '', 
            currency: transactionEntity.currency || "USD",
            description: `${qty} ${req.body.itemname}(s) returned by ${req.user.firstname} ${req.user.lastname} because of ${issue}`,
            branch: user.branch,
            registrationpoint: null,
            ttype: staff ? 'DEBIT' : 'CREDIT',
            tfrom: 'BANK',
            tax: false,
        };

        const debitTransaction = await performTransactionOneWay(transaction);

        if (!debitTransaction) {
            await pg.query('ROLLBACK');
            console.error(`Transaction failed: Unable to debit ${transactionEntityType}`);
            await activityMiddleware(req, req.user.id, `Transaction failed: Unable to debit ${transactionEntityType}`, 'UPDATE_RETURN_ITEM');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: `Transaction failed: Unable to debit ${transactionEntityType}`,
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: [`Transaction failed: Unable to debit ${transactionEntityType}`]
            });
        }

        // Update the status and supplier of the item in the inventory
        // Update the inventory item with the new status and supplier information
        const updateResult = await pg.query(
            `UPDATE skyeu."Inventory" 
             SET transactiondesc = $1, 
                 supplier = $2, 
                 staff = $4 
             WHERE id = $3`,
            [
                'RETURNED ITEMS', // Set the status to 'RETURNED ITEMS'
                supplier??0, // Update the supplier, or set to null if not provided
                id, // The ID of the inventory item to update
                staff??0 // Update the staff if the condition is met
            ]
        );
        if (updateResult.rowCount === 0) {
            console.error('Update failed: No rows affected');
            await pg.query('ROLLBACK');
            await activityMiddleware(req, req.user.id, 'Update failed: No rows affected', 'UPDATE_RETURN_ITEM');
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "Update failed: No rows affected",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: ["Update failed: No rows affected"]
            });
        }

        // Log activity for the update
        await activityMiddleware(req, req.user.id, `Status and supplier for item ID ${id} updated to RETURNED ITEMS and ${supplier || 'null'}`, 'UPDATE_RETURN_ITEM');

        // Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "item(s) returned successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, req.user.id, 'An unexpected error occurred updating return item', 'UPDATE_RETURN_ITEM');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

module.exports = { updateReturnItem };
