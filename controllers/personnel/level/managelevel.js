const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const saveOrUpdateLevel = async (req, res) => {
    const user = req.user;
    const { id, level, description, basicsalary, allowancerowsize, deductionrowsize } = req.body;

    try {
        await pg.query('BEGIN');

        if (id) {
            // Delete existing allowances and deductions for the level
            await pg.query(`DELETE FROM skyeu."allowances" WHERE level = $1`, [id]);
            await pg.query(`DELETE FROM skyeu."deductions" WHERE level = $1`, [id]);
        }

        // Insert or update level
        let levelId = id;
        if (id) {
            await pg.query(
                `UPDATE skyeu."level" SET level = $1, description = $2, basicsalary = $3, dateadded = NOW(), createdby = $4, status = 'ACTIVE' WHERE id = $5`,
                [level, description, basicsalary, user.id, id]
            );
        } else {
            const { rows } = await pg.query(
                `INSERT INTO skyeu."level" (level, description, basicsalary, dateadded, createdby, status) VALUES ($1, $2, $3, NOW(), $4, 'ACTIVE') RETURNING id`,
                [level, description, basicsalary, user.id]
            );
            levelId = rows[0].id;
        }

        // Insert allowances
        for (let i = 1; i <= allowancerowsize; i++) {
            const allowanceKey = `allowance${i}`;
            const allowancetypeKey = `allowancetype${i}`;
            const allowance = req.body[allowanceKey];
            const allowancetype = req.body[allowancetypeKey];

            await pg.query(
                `INSERT INTO skyeu."allowances" (level, allowance, allowancetype, dateadded, createdby, status) VALUES ($1, $2, $3, NOW(), $4, 'ACTIVE')`,
                [levelId, allowance, allowancetype, user.id]
            );
        }

        // Insert deductions
        for (let i = 1; i <= deductionrowsize; i++) {
            const deductionKey = `deduction${i}`;
            const deductiontypeKey = `deductiontype${i}`;
            const deduction = req.body[deductionKey];
            const deductiontype = req.body[deductiontypeKey];

            await pg.query(
                `INSERT INTO skyeu."deductions" (level, deduction, deductiontype, dateadded, createdby, status) VALUES ($1, $2, $3, NOW(), $4, 'ACTIVE')`,
                [levelId, deduction, deductiontype, user.id]
            );
        }

        await pg.query('COMMIT');

        await activityMiddleware(req, user.id, 'Level saved or updated successfully', 'LEVEL');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: id ? "Level updated successfully" : "Level saved successfully",
            statuscode: StatusCodes.OK,
            data: { id: levelId },
            errors: []
        });
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred saving or updating level', 'LEVEL');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { saveOrUpdateLevel };


