const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");

const viewSalesByMonth = async (req, res) => {
    let { userid, date, branch } = req.query;
    userid = parseInt(userid) ?? null;
    branch = parseInt(branch) ?? null;
    const month = date;

    if (!month) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Month is required (format: YYYY-MM)",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Month is required"]
        });
    }

    // Validate month format
    const [year, monthNum] = month.split('-').map(Number);
    if (isNaN(year) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Invalid month format. Use YYYY-MM",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Invalid month format"]
        });
    }

    try {
        // Generate all dates in the month
        const daysInMonth = getDaysInMonth(year, monthNum);
        const dateStrings = daysInMonth.map(d => d.toISOString().split('T')[0]);

        // Corrected SQL query with proper joins and grouping
        let baseQuery = `
            WITH sales_transactions AS (
                SELECT DISTINCT reference 
                FROM skyeu."Inventory"
                WHERE transactiondesc = 'DEP-SALES'
                AND DATE_TRUNC('month', transactiondate::timestamp) = $1::timestamp
            )
            SELECT 
                DATE(T.transactiondate::timestamp) AS sale_date,
                T.transactionref,
                SUM(T.credit) as total_credit,
                SUM(T.debit) as total_debit,
                T.userid,
                U.branch
            FROM skyeu."transaction" T
            INNER JOIN sales_transactions ST 
                ON T.transactionref = ST.reference
            INNER JOIN skyeu."User" U 
                ON T.userid = U.id
            WHERE DATE_TRUNC('month', T.transactiondate::timestamp) = $1::timestamp
        `;
        const queryParams = [`${year}-${monthNum.toString().padStart(2, '0')}-01`];

        if (userid) {
            baseQuery += ` AND T.userid = $${queryParams.length + 1}`;
            queryParams.push(userid);
        }
        
        if (branch) {
            baseQuery += ` AND U.branch = $${queryParams.length + 1}`;
            queryParams.push(branch);
        }

        baseQuery += ` GROUP BY sale_date, T.transactionref, T.userid, U.branch`;

        // Execute main query
        const { rows } = await pg.query({
            text: baseQuery,
            values: queryParams
        });

        // Process transactions
        const dailySales = new Map(); 

        rows.forEach(row => {
            const dateStr = row.sale_date.toISOString().split('T')[0]; 
            const transactionAmount = row.total_credit - row.total_debit;
            
            if (!dailySales.has(dateStr)) {
                dailySales.set(dateStr, {
                    totalAmount: 0,
                    transactionCount: 0
                });
            }
            const dayEntry = dailySales.get(dateStr);
            dayEntry.transactionCount += 1;
            dayEntry.totalAmount += transactionAmount;
        });

        // Create complete daily data with zero-filled entries
        const daysData = dateStrings.map(dateStr => ({
            date: dateStr,
            totalAmount: Number((dailySales.get(dateStr)?.totalAmount || 0).toFixed(2)),
            transactionCount: dailySales.get(dateStr)?.transactionCount || 0
        }));

        // Calculate monthly totals
        const monthlySummary = daysData.reduce((acc, day) => {
            acc.totalAmount += day.totalAmount;
            acc.totalTransactions += day.transactionCount;
            return acc;
        }, { totalAmount: 0, totalTransactions: 0 });

        // Get branch and cashier info if userid provided
        let branchInfo = { branch: 'All Branches', branchname: 'All Branches' };
        let cashier = 'Multiple Cashiers';
        
        if (userid) {
            try {
                // Get branch information
                const branchQuery = {
                    text: `
                        SELECT B.id, B.branch 
                        FROM skyeu."Branch" B
                        INNER JOIN skyeu."User" U ON U.branch = B.id
                        WHERE U.id = $1
                    `,
                    values: [userid]
                };
                const { rows: branchRows } = await pg.query(branchQuery);
                
                if (branchRows.length > 0) {
                    branchInfo = branchRows[0];
                }

                // Get cashier name
                const userQuery = {
                    text: `
                        SELECT 
                            TRIM(
                                CONCAT(
                                    COALESCE(firstname, ''),
                                    ' ',
                                    COALESCE(lastname, ''),
                                    ' ',
                                    COALESCE(othernames, '')
                                )
                            ) AS fullname
                        FROM skyeu."User"
                        WHERE id = $1
                    `,
                    values: [userid]
                };
                const { rows: userRows } = await pg.query(userQuery);
                
                if (userRows.length > 0) {
                    cashier = userRows[0].fullname.replace(/\s+/g, ' ').trim();
                }
            } catch (error) {
                console.error('Error fetching user/branch info:', error);
            }
        } else if (branch) {
            try {
                // Get branch information for branch filter
                const branchQuery = {
                    text: `
                        SELECT branch
                        FROM skyeu."Branch" 
                        WHERE id = $1
                    `,
                    values: [branch]
                };
                const { rows: branchRows } = await pg.query(branchQuery);

                if (branchRows.length > 0) {
                    branchInfo = { branch: branchRows[0].branch, branchname: branchRows[0].branch };
                }
            } catch (error) {
                console.error('Error fetching branch info:', error);
            }
        }

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Monthly sales data fetched successfully",
            statuscode: StatusCodes.OK,
            data: {
                days: daysData,
                monthlySummary: {
                    totalAmount: Number(monthlySummary.totalAmount.toFixed(2)),
                    totalTransactions: monthlySummary.totalTransactions,
                    branch: branchInfo.branch,
                    ...(userid && { cashier })
                }
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
};

// Helper function to generate all dates in a month
function getDaysInMonth(year, month) {
    const date = new Date(year, month - 1, 1);
    const days = [];
    while (date.getMonth() === month - 1) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
}

module.exports = { viewSalesByMonth };