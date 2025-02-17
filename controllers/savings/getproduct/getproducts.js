const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware for activity tracking
const pg = require("../../../db/pg"); // Import PostgreSQL database connection

// Function to handle GET savings products request including deductions and interest
const getSavingsProducts = async (req, res) => {

    let userid;

    // Extract user from request  
    const user = req.user 

    try {
        const query = `
            SELECT 
                sp.*,  
                COALESCE(json_agg(DISTINCT d) FILTER (WHERE d.id IS NOT NULL), '[]') AS deductions,
                COALESCE(json_agg(DISTINCT i) FILTER (WHERE i.id IS NOT NULL), '[]') AS interests,
                CASE 
                    WHEN sp.membership IS NOT NULL THEN
                        CASE 
                            WHEN sp.membership ~ '^[0-9]+$' THEN
                                (SELECT dm.member FROM sky."DefineMember" dm WHERE dm.id = sp.membership::int)
                            ELSE
                                (SELECT string_agg(dm.member, '||') 
                                 FROM sky."DefineMember" dm 
                                 WHERE dm.id = ANY(string_to_array(sp.membership, '||')::int[]))
                        END
                    ELSE NULL
                END AS membervalues
            FROM 
                sky."savingsproduct" sp
            LEFT JOIN 
                sky."Deduction" d ON sp.id = d.savingsproductid AND d.status = 'ACTIVE' 
            LEFT JOIN 
                sky."Interest" i ON sp.id = i.savingsproductid AND i.status = 'ACTIVE'
            WHERE 
                sp.status = 'ACTIVE'
            GROUP BY 
                sp.id
        `;
 
        const { rows: savingsproducts } = await pg.query(query);
 
        if (savingsproducts.length > 0) {
            await activityMiddleware(req, user.id, 'Savings products, deductions, and interest fetched successfully', 'SAVINGSPRODUCT'); // Tracker middleware
            return res.status(StatusCodes.OK).json({  
                status: true,
                message: "Savings products, deductions, and interest fetched successfully", 
                statuscode: StatusCodes.OK, 
                data: savingsproducts, 
                errors: []
            });  
        } else { 
            await activityMiddleware(req, user.id, 'No savings products found', 'SAVINGSPRODUCT'); // Tracker middleware
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "No savings products found",
                statuscode: StatusCodes.OK,
                data: '',
                errors: []  
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching savings products, deductions, and interest', 'SAVINGSPRODUCT'); // Tracker middleware
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
    getSavingsProducts
};



