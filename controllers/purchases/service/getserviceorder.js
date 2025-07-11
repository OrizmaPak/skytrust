const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getServices = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `SELECT * FROM skyeu."Service" WHERE status = 'SO'`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = '';
        let valueIndex = 1;
        Object.keys(req.query).forEach((key) => {
            if (key !== 'q' && key !== 'startdate' && key !== 'enddate') {
                if (whereClause) {
                    whereClause += ` AND `;
                } else {
                    whereClause += ` AND `;
                }
                whereClause += `"${key}" = $${valueIndex}`; 
                query.values.push(req.query[key]);
                valueIndex++;
            }
        });

        // Add startdate and enddate filtering 
        const startdate = req.query.startdate;
        const enddate = req.query.enddate;
        if (startdate && enddate) {
            if (whereClause) {
                whereClause += ` AND servicestartdate >= $${valueIndex} AND serviceenddate <= $${valueIndex + 1}`;
            } else {
                whereClause += ` AND servicestartdate >= $${valueIndex} AND serviceenddate <= $${valueIndex + 1}`;
            }
            query.values.push(startdate, enddate);
            valueIndex += 2;
        } else if (startdate) {
            if (whereClause) {
                whereClause += ` AND servicestartdate >= $${valueIndex}`;
            } else {
                whereClause += ` AND servicestartdate >= $${valueIndex}`;
            }
            query.values.push(startdate);
            valueIndex++;
        } else if (enddate) {
            if (whereClause) {
                whereClause += ` AND serviceenddate <= $${valueIndex}`;
            } else {
                whereClause += ` AND serviceenddate <= $${valueIndex}`;
            }
            query.values.push(enddate);
            valueIndex++;
        }

        query.text += whereClause;

        console.log(query.text);

        const result = await pg.query(query);
        const services = result.rows;

        // Group services by reference
        const groupedServices = services.reduce((acc, service) => {
            if (!acc[service.reference]) {
                acc[service.reference] = {
                    reference: service.reference,
                    branchname: null,
                    suppliername: null,
                    services: []
                };
            }
            acc[service.reference].services.push(service);
            return acc;
        }, {});

        // Fetch branch and supplier names
        for (const ref in groupedServices) {
            const firstService = groupedServices[ref].services[0];
            const branchQuery = `SELECT branch FROM skyeu."Branch" WHERE id = $1`;
            const supplierQuery = `SELECT supplier FROM skyeu."Supplier" WHERE id = $1`;

            const { rows: [branch] } = await pg.query(branchQuery, [firstService.branch]);
            const { rows: [supplier] } = await pg.query(supplierQuery, [firstService.supplier]);

            groupedServices[ref].branchname = branch ? branch.branch : null;
            groupedServices[ref].suppliername = supplier ? supplier.supplier : null;
        }

        await activityMiddleware(req, user.id, 'Services fetched successfully', 'SERVICE');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Services fetched successfully",
            statuscode: StatusCodes.OK,
            data: Object.values(groupedServices),
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching services', 'SERVICE');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getServices };
