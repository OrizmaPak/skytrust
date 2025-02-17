const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const saveOrUpdateRecipient = async (req, res) => {
    const user = req.user;
    const { id, fullname, bank, accountnumber, status } = req.body;

    // Basic validation
    if (!fullname || !bank || !accountnumber) {
        let errors = [];
        if (!fullname) {
            errors.push({
                field: 'Fullname',
                message: 'Fullname is required'
            });
        }
        if (!bank) {
            errors.push({
                field: 'Bank',
                message: 'Bank is required'
            });
        }
        if (!accountnumber) {
            errors.push({
                field: 'Account Number',
                message: 'Account number is required'
            });
        }

        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Missing Fields",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: errors
        });
    }

    try {
        let query;
        let values;

        if (id) {
            // Update existing recipient
            query = `
                UPDATE sky."reciepients"
                SET fullname = COALESCE($1, fullname), 
                    bank = COALESCE($2, bank), 
                    accountnumber = COALESCE($3, accountnumber), 
                    status = COALESCE($4, status), 
                    createdby = COALESCE($5, createdby)
                WHERE id = $6
                RETURNING *
            `;
            values = [fullname, bank, accountnumber, status || 'ACTIVE', user.id, id];
        } else {
            // Insert new recipient
            query = `
                INSERT INTO sky."reciepients" (fullname, bank, accountnumber, status, createdby)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            values = [fullname, bank, accountnumber, status || 'ACTIVE', user.id];
        }

        const { rows: [recipientRecord] } = await pg.query(query, values);

        await activityMiddleware(req, user.id, id ? 'Recipient updated successfully' : 'Recipient added successfully', 'RECIPIENT');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: id ? "Recipient updated successfully" : "Recipient added successfully",
            statuscode: StatusCodes.OK,
            data: recipientRecord,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred while saving recipient', 'RECIPIENT');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message] 
        });
    }
};

module.exports = { saveOrUpdateRecipient };
