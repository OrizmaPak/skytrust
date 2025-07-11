const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");

const viewSalesByYear = async (req, res) => {
    let { userid, year, branch } = req.query;
    userid = parseInt(userid) || null; // Ensure it's either an integer or null
    branch = parseInt(branch) || null; // Ensure it's either an integer or null

    // Validate year input
    if (!year || isNaN(year)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Year is required (format: YYYY)",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Year is required"]
        });
    }

    try {
        // Array to hold monthly sales data
        const monthlyData = [];

        // Iterate through each month of the year
        for (let month = 1; month <= 12; month++) {
            const queryParams = [`${year}-${month.toString().padStart(2, '0')}-01`];

            // Base SQL query to fetch sales transactions for the specified month
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
            if (userid) {
                baseQuery += ` AND T.userid = $${queryParams.length + 1}`;
                queryParams.push(userid);
            }
            
            if (branch) {
                baseQuery += ` AND U.branch = $${queryParams.length + 1}`;
                queryParams.push(branch);
            }

            baseQuery += ` GROUP BY sale_date, T.transactionref, T.userid, U.branch`;

            // Execute the main query
            const { rows } = await pg.query({
                text: baseQuery,
                values: queryParams
            });

            // Process transactions into daily sales data
            const dailySales = new Map();
            rows.forEach(row => {
                const dateStr = row.sale_date.toISOString().split('T')[0]; 
                const transactionAmount = row.total_credit - row.total_debit;
                
                if (!dailySales.has(dateStr)) {
                    dailySales.set(dateStr, { totalAmount: 0, transactionCount: 0 });
                }
                
                const dayEntry = dailySales.get(dateStr);
                dayEntry.transactionCount += 1;
                dayEntry.totalAmount += transactionAmount;
            });

            // Create complete daily data with zero-filled entries
            const daysInMonth = getDaysInMonth(year, month);
            const dateStrings = daysInMonth.map(d => d.toISOString().split('T')[0]);
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
                    // Fetch branch information based on user ID
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
                    
                    // Fetch cashier name based on user ID
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
                    // Fetch branch information based on branch ID
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

            monthlyData.push({
                month,
                days: daysData,
                monthlySummary: {
                    totalAmount: Number(monthlySummary.totalAmount.toFixed(2)),
                    totalTransactions: monthlySummary.totalTransactions,
                    branch: branchInfo.branch,
                    ...(userid && { cashier })
                }
            });
        }

        // Calculate yearly totals
        const yearlySummary = monthlyData.reduce((acc, monthData) => {
            acc.totalAmount += monthData.monthlySummary.totalAmount;
            acc.totalTransactions += monthData.monthlySummary.totalTransactions;
            return acc;
        }, { totalAmount: 0, totalTransactions: 0 });

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Yearly sales data fetched successfully",
            statuscode: StatusCodes.OK,
            data: {
                months: monthlyData,
                yearlySummary: {
                    totalAmount: Number(yearlySummary.totalAmount.toFixed(2)),
                    totalTransactions: yearlySummary.totalTransactions
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

module.exports = { viewSalesByYear }; 