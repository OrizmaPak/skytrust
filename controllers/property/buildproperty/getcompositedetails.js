const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getCompositeDetails = async (req, res) => {
    console.log('we entered the get composite details');
    const user = req.user;

    try {
        let query = {
            text: `SELECT cd.compositeid, 
                          i.itemname AS compositename,
                          cd.itemid, 
                          inv.itemname AS itemidname,
                          inv.pricetwo, 
                          cd.qty, 
                          cd.createdby, 
                          cd.dateadded, 
                          cd.status 
                   FROM sky."compositedetails" cd
                   JOIN sky."Inventory" i ON cd.compositeid = i.itemid
                   JOIN sky."Inventory" inv ON cd.itemid = inv.itemid
                   WHERE inv.id = (
                       SELECT MAX(id) FROM sky."Inventory" WHERE itemid = cd.itemid
                   )`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters 
        let whereClause = '';
        let valueIndex = 1;
        Object.keys(req.query).forEach((key) => {
            if (key !== 'q' && key !== 'sort' && key !== 'compositeid') {
                if (whereClause) {
                    whereClause += ` AND `;
                } else {
                    whereClause += ` WHERE `;
                }
                whereClause += `"${key}" = $${valueIndex}`;
                query.values.push(req.query[key]);
                valueIndex++;
            }
        });

        // Add search query if provided
        if (req.query.q) {
            // Fetch column names from the 'compositedetails' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'compositedetails'
            `);

            const cols = columns.map(row => row.column_name);

            // Generate the dynamic SQL query
            const searchConditions = cols.map(col => `${col}::text ILIKE $${valueIndex}`).join(' OR ');
            if (whereClause) {
                whereClause += ` AND (${searchConditions})`;
            } else {
                whereClause += ` WHERE (${searchConditions})`;
            }
            query.values.push(`%${req.query.q}%`);
            valueIndex++;
        }

        query.text += whereClause;

        // Add sorting if provided
        if (req.query.sort) {
            const sortParams = req.query.sort.split(',');
            const sortConditions = sortParams.map(param => {
                const [field, order] = param.split(':');
                return `"${field}" ${order.toUpperCase()}`;
            }).join(', ');
            query.text += ` ORDER BY ${sortConditions}`;
        }

        // Add pagination
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || process.env.DEFAULT_LIMIT, 10);
        const offset = (page - 1) * limit;

        query.text += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
        query.values.push(limit, offset);

        console.log('Executing query:', query.text, 'with values:', query.values);
        const result = await pg.query(query);
        const compositeDetails = result.rows;
        console.log('Query result:', compositeDetails);

        // Group the items by compositeid
        const groupedCompositeDetails = compositeDetails.reduce((acc, curr) => {
            let composite = acc.find(item => item.compositeid === curr.compositeid);
            if (!composite) {
                composite = {
                    compositeid: curr.compositeid,
                    compositename: curr.compositename,
                    items: []
                };
                acc.push(composite);
            }
            // Ensure itemid is unique in composite.items
            const existingItem = composite.items.find(item => item.itemid === curr.itemid);
            if (!existingItem) {
                composite.items.push({
                    itemid: curr.itemid,
                    itemidname: curr.itemidname,
                    price: curr.pricetwo,  // Added pricetwo
                    qty: curr.qty,
                    createdby: curr.createdby,
                    dateadded: curr.dateadded,
                    status: curr.status
                });
            }
            return acc;
        }, []);
        console.log('Grouped composite details:', groupedCompositeDetails);

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM sky."compositedetails" cd
                   JOIN sky."Inventory" i ON cd.compositeid = i.compositeid
                   JOIN (
                       SELECT itemid, itemname, pricetwo
                       FROM sky."Inventory" inv
                       WHERE inv.id = (
                           SELECT MAX(id) FROM sky."Inventory" WHERE itemid = inv.itemid
                       )
                   ) inv ON cd.itemid = inv.itemid
                   ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        console.log('Executing count query:', countQuery.text, 'with values:', countQuery.values);
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = divideAndRoundUp(total, limit);
        console.log('Total count:', total, 'Total pages:', pages);

        await activityMiddleware(req, user.id, 'Composite details fetched successfully', 'COMPOSITE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Composite details fetched successfully",
            statuscode: StatusCodes.OK,
            data: req.query.compositeid ? groupedCompositeDetails.filter(item => item.compositeid == req.query.compositeid) : groupedCompositeDetails,
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
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching composite details', 'COMPOSITE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getCompositeDetails };