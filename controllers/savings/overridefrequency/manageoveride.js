const pg = require('../../../db/pg'); // Use your existing pg setup
const { StatusCodes } = require('http-status-codes'); // Assuming you are using http-status-codes for status codes
const { activityMiddleware } = require('../../../middleware/activity'); // Import activity middleware

const saveOrUpdateFrequencyOverride = async (req, res) => {
    const { savingsproductid, compulsorydepositfrequency, branch } = req.body;

    if (!savingsproductid || !compulsorydepositfrequency || !branch) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Missing required fields",
            errors: ["savingsproductid, compulsorydepositfrequency, and branch are required."]
        });
    }

    const client = pg; // Use the pg client for database operations

    try {
        await client.query('BEGIN'); // Start a transaction

        // Check if a record with the same savingsproductid and branch already exists
        const checkQuery = `
            SELECT * FROM skyeu."frequencyoverride"  
            WHERE savingsproductid = $1 AND branch = $2
        `;
        const checkResult = await client.query(checkQuery, [savingsproductid, branch]);

        if (checkResult.rowCount > 0) {
            // If exists, update the compulsorydepositfrequency
            const updateQuery = `
                UPDATE skyeu."frequencyoverride"
                SET compulsorydepositfrequency = $1
                WHERE savingsproductid = $2 AND branch = $3
            `;
            await client.query(updateQuery, [compulsorydepositfrequency, savingsproductid, branch]);
            await activityMiddleware(req, req.user.id, 'Frequency override updated', 'FREQUENCY_OVERRIDE');
            await client.query('COMMIT'); // Commit the transaction

            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Frequency override updated successfully",
                errors: []
            });
        } else {
            // If not exists, insert a new record
            const insertQuery = `
                INSERT INTO skyeu."frequencyoverride" (savingsproductid, compulsorydepositfrequency, branch, status)
                VALUES ($1, $2, $3, 'ACTIVE')
            `;
            await client.query(insertQuery, [savingsproductid, compulsorydepositfrequency, branch]);
            await activityMiddleware(req, req.user.id, 'Frequency override created', 'FREQUENCY_OVERRIDE');
            await client.query('COMMIT'); // Commit the transaction

            return res.status(StatusCodes.CREATED).json({
                status: true,
                message: "Frequency override created successfully",
                errors: []
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        await client.query('ROLLBACK'); // Rollback the transaction in case of error
        await activityMiddleware(req, req.user.id, 'An unexpected error occurred', 'FREQUENCY_OVERRIDE');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            errors: [err.message]
        });
    }
};

module.exports = {
    saveOrUpdateFrequencyOverride
};
