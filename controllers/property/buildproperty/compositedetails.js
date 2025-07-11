const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const saveCompositeDetails = async (req, res) => {
    const user = req.user;
    const { compositeid, rowsize, ...items } = req.body;

    try {
        // Validate input
        if (!compositeid || !rowsize || rowsize < 1) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Invalid input",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ["compositeid and rowsize are required"]
            });
        }

        // Check if compositeid exists
        const { rowCount: existingCount } = await pg.query({
            text: `SELECT 1 FROM skyeu."compositedetails" WHERE compositeid = $1`,
            values: [compositeid]
        });

        // If exists, delete all rows with the compositeid
        if (existingCount > 0) {
            await pg.query({
                text: `DELETE FROM skyeu."compositedetails" WHERE compositeid = $1`,
                values: [compositeid]
            });
        }

        // Prepare insert query
        let insertQuery = `INSERT INTO skyeu."compositedetails" (compositeid, itemid, qty, createdby, dateadded, status) VALUES `;
        const values = [];
        let valueIndex = 1;

        for (let i = 1; i <= rowsize; i++) {
            const itemid = items[`itemid${i}`];
            const qty = items[`qty${i}`];

            if (!itemid || !qty) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Invalid input for item ${i}`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: [`itemid${i} and qty${i} are required`]
                });
            }

            insertQuery += `($${valueIndex}, $${valueIndex + 1}, $${valueIndex + 2}, $${valueIndex + 3}, NOW(), 'ACTIVE'), `;
            values.push(compositeid, itemid, qty, user.id);
            valueIndex += 4;
        }

        // Remove trailing comma and space
        insertQuery = insertQuery.slice(0, -2);

        // Execute insert query
        await pg.query({
            text: insertQuery,
            values
        });

        await activityMiddleware(req, user.id, 'Composite details saved successfully', 'COMPOSITE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Composite details saved successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving composite details', 'COMPOSITE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { saveCompositeDetails };
