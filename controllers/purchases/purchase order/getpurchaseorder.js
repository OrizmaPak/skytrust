const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getPurchaseOrder = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `
                SELECT 
                    MAX(i.transactiondate) as transactiondate, 
                    MAX(s.supplier) as suppliername, 
                    MAX(b.branch) as branchname,
                    MAX(d.department) as departmentname,
                    i.transactionref, 
                    JSON_AGG(ROW_TO_JSON(i)) as items
                FROM skyeu."Inventory" i
                LEFT JOIN skyeu."Supplier" s ON i.supplier::text = s.id::text
                LEFT JOIN skyeu."Branch" b ON i.branch::text = b.id::text
                LEFT JOIN skyeu."Department" d ON i.department::text = d.id::text
                WHERE i.status = 'PO'
            `,
            values: []
        };

        // Add filter by transactionref if provided
        if (req.query.transactionref) {
            query.text += ` AND i.transactionref = $${query.values.length + 1}`;
            query.values.push(req.query.transactionref);
        }

        // Add filter by transactiondate range if startdate and enddate are provided
        const startDate = req.query.startdate;
        const endDate = req.query.enddate;
        if (startDate || endDate) {
            if (startDate) {
                query.text += ` AND i.transactiondate >= $${query.values.length + 1}`;
                query.values.push(startDate);
            }
            if (endDate) {
                query.text += ` AND i.transactiondate <= $${query.values.length + 1}`;
                query.values.push(endDate);
            }
        }

        query.text += ` GROUP BY i.transactionref, s.supplier`;

        // Add pagination
        const searchParams = new URLSearchParams(req.query);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
        const offset = (page - 1) * limit;

        query.text += ` LIMIT $${query.values.length + 1} OFFSET $${query.values.length + 2}`;
        query.values.push(limit, offset);

        const result = await pg.query(query);
        const purchaseOrders = result.rows;

        if (purchaseOrders.length === 0) {
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "No purchase orders found",
                statuscode: StatusCodes.OK,
                data: [],
                errors: ["No purchase orders found"]
            });
        }

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(DISTINCT reference) FROM skyeu."Inventory" WHERE status = 'PO'`,
            values: []
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = divideAndRoundUp(total, limit);

        await activityMiddleware(req, user.id, 'Purchase orders fetched successfully', 'PURCHASE ORDER');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Purchase orders fetched successfully",
            statuscode: StatusCodes.OK,
            data: purchaseOrders,
            pagination: {
                total: Number(total),
                pages,
                page,
                limit
            },
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching purchase orders', 'PURCHASE ORDER');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getPurchaseOrder };
