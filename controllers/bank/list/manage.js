const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const saveOrUpdateBank = async (req, res) => {
    const user = req.user;
    const { id, bank, country, status } = req.body;

    // Basic validation
    if (!bank || !country) {
        let errors = [];
        if (!bank) {
            errors.push({
                field: 'Bank',
                message: 'Bank name is required'
            });
        }
        if (!country) {
            errors.push({
                field: 'Country',
                message: 'Country is required'
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
            // Update existing bank
            query = `
                UPDATE skyeu."listofbanks"
                SET bank = COALESCE($1, bank), 
                    country = COALESCE($2, country), 
                    status = COALESCE($3, status), 
                    createdby = COALESCE($4, createdby)
                WHERE id = $5
                RETURNING *
            `;
            values = [bank, country, status || 'ACTIVE', user.id, id];
        } else {
            // Insert new bank
            query = `
                INSERT INTO skyeu."listofbanks" (bank, country, status, createdby)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            values = [bank, country, status || 'ACTIVE', user.id];
        }

        const { rows: [bankRecord] } = await pg.query(query, values);

        await activityMiddleware(req, user.id, id ? 'Bank updated successfully' : 'Bank added successfully', 'BANK');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: id ? "Bank updated successfully" : "Bank added successfully",
            statuscode: StatusCodes.OK,
            data: bankRecord,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred while saving bank', 'BANK');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message] 
        });
    }
};

module.exports = { saveOrUpdateBank };
 