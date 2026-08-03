const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { hasPermission } = require("../../../utils/permissions");

async function getroles(req, res) {
    try {
        const searchParams = new URLSearchParams(req.query);
        const page = parseInt(searchParams.get('page'), 10) || 1;
        const limit = parseInt(searchParams.get('limit'), 10) || 10;
        const q = searchParams.get('q') || '';
        const id = searchParams.get('id');
        const role = searchParams.get('role');
        const offset = (page - 1) * limit;

        if (!id && !role && !hasPermission(req.user, 'ACCESS CONTROL')) {
            return res.status(StatusCodes.FORBIDDEN).json({
                status: false,
                message: "You are not authorized to view roles",
                statuscode: StatusCodes.FORBIDDEN,
                data: null,
                errors: []
            });
        }

        let query;
        let countQuery;
        if (id) {
            query = {
                text: `SELECT * FROM skytobi."Roles" WHERE id = $1`,
                values: [id]
            };
            countQuery = {
                text: `SELECT COUNT(*) FROM skytobi."Roles" WHERE id = $1`,
                values: [id]
            };
        } else if (role) {
            query = {
                text: `SELECT * FROM skytobi."Roles" WHERE role = $1`,
                values: [role]
            };
            countQuery = {
                text: `SELECT COUNT(*) FROM skytobi."Roles" WHERE role = $1`,
                values: [role]
            };
        } else {
            query = {
                text: `SELECT * FROM skytobi."Roles" WHERE role ILIKE $1 OR permissions ILIKE $1 OR description ILIKE $1 ORDER BY role LIMIT $2 OFFSET $3`,
                values: [`%${q}%`, limit, offset]
            };
            countQuery = {
                text: `SELECT COUNT(*) FROM skytobi."Roles" WHERE role ILIKE $1 OR permissions ILIKE $1 OR description ILIKE $1`,
                values: [`%${q}%`]
            };
        }

        const { rows: roles } = await pg.query(query);
        const { rows: [{ count }] } = await pg.query(countQuery);

        const totalPages = Math.ceil(count / limit);

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Roles fetched successfully.",
            statuscode: StatusCodes.OK,
            data: roles,
            pagination: {
                page,
                limit,
                totalPages,
                totalCount: Number(count)
            },
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
}

module.exports = { getroles };
