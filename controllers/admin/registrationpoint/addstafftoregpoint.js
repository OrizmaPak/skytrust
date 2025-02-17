const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const addStaffToRegistrationPoint = async (req, res) => {
    const { id, registrationpoint } = req.body;

    // Basic validation
    if (!id || registrationpoint === undefined) {
        let errors = [];
        if (!id) {
            errors.push({
                field: 'ID',
                message: 'User ID not provided'
            });
        }
        if (registrationpoint === undefined) {
            errors.push({
                field: 'Registration Point',
                message: 'Registration point not provided'
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
        const { rows: [user] } = await pg.query(`SELECT * FROM sky."User" WHERE id = $1`, [id]);

        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "User not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        if (registrationpoint != 0) {
            if (user.registrationpoint != 0) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "User is already in a registration point. Please remove the staff from their current registration point before adding to a new one.",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            await pg.query(`UPDATE sky."User" SET registrationpoint = $1 WHERE id = $2`, [registrationpoint, id]);
            await activityMiddleware(req, req.user.id, `User added to registration point ${registrationpoint}`, 'REGISTRATIONPOINT');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "User added to registration point successfully",
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            });
        } else {
            await pg.query(`UPDATE sky."User" SET registrationpoint = 0 WHERE id = $1`, [id]);
            await activityMiddleware(req, req.user.id, `User removed from registration point`, 'REGISTRATIONPOINT');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "User has been removed from their registration point",
                statuscode: StatusCodes.OK,
                data: null,
                errors: []
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        await activityMiddleware(req, req.user.id, `An unexpected error occurred while managing user registration point`, 'REGISTRATIONPOINT');
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}

module.exports = {
    addStaffToRegistrationPoint
};


