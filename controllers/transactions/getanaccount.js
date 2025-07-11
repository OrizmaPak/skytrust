const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");
const { activityMiddleware } = require("../../middleware/activity");
const { divideAndRoundUp } = require("../../utils/pageCalculator");

const getaccountTransactions = async (req, res) => {
    const user = req.user;

    try {
        // 1. Build the main query to fetch filtered transactions
        let query = {
            text: `SELECT * FROM skyeu."transaction"`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = '';  
        let valueIndex = 1;
        const { startdate, enddate, q, accountnumber, ...filters } = req.query;

        // Add filters
        Object.keys(filters).forEach((key) => {
            if (key !== 'q') {
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

        // Add account number filter
        if (accountnumber) {
            if (whereClause) {
                whereClause += ` AND `;
            } else {
                whereClause += ` WHERE `;
            }
            whereClause += `"accountnumber" = $${valueIndex}`;
            query.values.push(accountnumber);
            valueIndex++;
        }

        // Add date range filter if provided
        if (startdate) {
            if (whereClause) {
                whereClause += ` AND `;
            } else {
                whereClause += ` WHERE `;
            }
            whereClause += `"dateadded" >= $${valueIndex}`;
            query.values.push(startdate);
            valueIndex++;
        }

        if (enddate) {
            if (whereClause) {
                whereClause += ` AND `;
            } else {
                whereClause += ` WHERE `;
            }
            whereClause += `"dateadded" <= $${valueIndex}`;
            query.values.push(enddate);
            valueIndex++;
        }

        // Add search query if provided
        if (q) {
            // Fetch column names from the 'transaction' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'sky' AND table_name = 'transaction'
            `);

            const cols = columns.map(row => row.column_name);

            // Generate the dynamic SQL query with unique placeholders
            const searchConditions = cols.map(col => {
                const placeholder = `$${valueIndex}`;
                query.values.push(`%${q}%`);
                valueIndex++;
                return `${col}::text ILIKE ${placeholder}`;
            }).join(' OR ');

            if (whereClause) {
                whereClause += ` AND (${searchConditions})`;
            } else {
                whereClause += ` WHERE (${searchConditions})`;
            }
        }

        // 2. Capture the current state of query.values for sum and count queries
        const sumQueryValues = [...query.values];
        const countQuery = {
            text: `SELECT COUNT(*) FROM skyeu."transaction" ${whereClause}`,
            values: [...query.values]
        };

        // 3. Add pagination
        const searchParams = new URLSearchParams(req.query);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
        const offset = (page - 1) * limit;

        query.text += whereClause;

        // Add LIMIT and OFFSET for pagination
        query.text += ` ORDER BY "dateadded" ASC, "id" ASC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
        query.values.push(limit, offset);
        valueIndex += 2;

        // 4. Execute the main query
        const result = await pg.query(query);
        const transactions = result.rows;

        // 5. Execute the count query
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = divideAndRoundUp(total, limit);

        // 6. Calculate Balance Brought Forward
        let openingBalance = 0;

        if (startdate && accountnumber) {
            const openingBalanceQuery = `
                SELECT 
                    COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) AS opening_balance
                FROM skyeu."transaction" 
                WHERE "dateadded" < $1 AND accountnumber = $2 AND status = 'ACTIVE'
            `;
            const { rows: [balanceRow] } = await pg.query(openingBalanceQuery, [startdate, accountnumber]);
            console.log(openingBalanceQuery, [startdate, accountnumber], balanceRow)
            openingBalance = parseFloat(balanceRow.opening_balance);
        }

        // 7. Calculate Current Balance
        let currentBalance = openingBalance;

        // Sum of credits and debits within the filtered range
        const transactionsSumQuery = `
            SELECT 
                COALESCE(SUM(credit), 0) AS total_credit, 
                COALESCE(SUM(debit), 0) AS total_debit
            FROM skyeu."transaction" 
            WHERE accountnumber = $1 AND status = 'ACTIVE'
        `; 
        // sumQueryValues.push(accountnumber);
        const { rows: [sumRow] } = await pg.query(transactionsSumQuery, [accountnumber]);
        const totalCredit = parseFloat(sumRow.total_credit);
        const totalDebit = parseFloat(sumRow.total_debit);
        currentBalance += (totalCredit - totalDebit);

        // 8. Log Activity
        await activityMiddleware(req, user.id, 'Transactions fetched successfully', 'TRANSACTION');

        // 9. Send Response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Transactions fetched successfully",
            statuscode: StatusCodes.OK,
            data: transactions,
            balancebroughtforward:openingBalance,
            balance:currentBalance,
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
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching transactions', 'TRANSACTION');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getaccountTransactions };
