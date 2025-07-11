const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");
const { activityMiddleware } = require("../../middleware/activity");
const { divideAndRoundUp } = require("../../utils/pageCalculator");

const getTransactions = async (req, res) => {
    const user = req.user;

    try {
        let query = {
            text: `SELECT * FROM skyeu."transaction"`,
            values: []
        };

        // Dynamically build the WHERE clause based on query parameters
        let whereClause = '';  
        let valueIndex = 1;
        Object.keys(req.query).forEach((key) => {
            if (key !== 'q' && key !== 'startdate' && key !== 'enddate' && key !== 'transactiondate') {
                let operator = '=';
                let actualKey = key;

                // Check for the [!] prefix indicating a NOT condition
                if (key.endsWith('[!]')) {
                    operator = '!=';
                    actualKey = key.slice(0, -3);
                }

                if (whereClause) {
                    whereClause += ` AND `;
                } else {
                    whereClause += ` WHERE `;
                }
                whereClause += `"${actualKey}" ${operator} $${valueIndex}`;
                query.values.push(req.query[key]);
                valueIndex++;
            }
        });

        // Add date range filter if provided
        if (req.query.startdate) {
            if (whereClause) {
                whereClause += ` AND `;
            } else {
                whereClause += ` WHERE `;
            }
            whereClause += `"transactiondate" >= $${valueIndex}`;
            query.values.push(new Date(req.query.startdate).toISOString());
            valueIndex++;
        }

        if (req.query.enddate) {
            if (whereClause) {
                whereClause += ` AND `;
            } else {
                whereClause += ` WHERE `;
            }
            whereClause += `"transactiondate" <= $${valueIndex}`;
            query.values.push(new Date(req.query.enddate).toISOString());
            valueIndex++;
        }

        // Add specific transaction date filter if provided
        if (req.query.transactiondate) {
            if (whereClause) {
                whereClause += ` AND `;
            } else {
                whereClause += ` WHERE `;
            }
            whereClause += `DATE("transactiondate") = $${valueIndex}`;
            query.values.push(req.query.transactiondate);
            valueIndex++;
        }

        // Add search query if provided
        if (req.query.q) {
            // Fetch column names from the 'transaction' table
            const { rows: columns } = await pg.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'sky' AND table_name = 'transaction'
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

        // Add pagination
        const searchParams = new URLSearchParams(req.query);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
        const offset = (page - 1) * limit;

        query.text += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
        query.values.push(limit, offset);

        const result = await pg.query(query);
        const transactions = result.rows;

        // Add account names to transactions
        for (let transaction of transactions) {
            let accountName = 'Unknown';
            const { whichaccount, accountnumber } = transaction;

            if (whichaccount === 'PERSONAL') {
                const { rows: orgSettings } = await pg.query(`SELECT personal_account_prefix FROM skyeu."Organisationsettings"`);
                const personalAccountPrefix = orgSettings[0].personal_account_prefix;
                const phone = accountnumber.replace(personalAccountPrefix, '');
                const { rows: users } = await pg.query(`SELECT firstname, lastname, othernames FROM skyeu."User" WHERE phone = $1`, [phone]);
                if (users.length > 0) {
                    const { firstname, lastname, othernames } = users[0];
                    accountName = `${firstname} ${lastname} ${othernames}`.trim();
                }
            } else if (whichaccount === 'SAVINGS') {
                const { rows: savings } = await pg.query(`SELECT userid FROM skyeu."savings" WHERE accountnumber = $1`, [accountnumber]);
                if (savings.length > 0) {
                    const { userid } = savings[0];
                    const { rows: users } = await pg.query(`SELECT firstname, lastname, othernames FROM skyeu."User" WHERE id = $1`, [userid]);
                    if (users.length > 0) {
                        const { firstname, lastname, othernames } = users[0];
                        accountName = `${firstname} ${lastname} ${othernames}`.trim();
                    }
                }
            } else if (whichaccount === 'LOAN') {
                const { rows: loans } = await pg.query(`SELECT userid FROM skyeu."loanaccounts" WHERE accountnumber = $1`, [accountnumber]);
                if (loans.length > 0) {
                    const { userid } = loans[0];
                    const { rows: users } = await pg.query(`SELECT firstname, lastname, othernames FROM skyeu."User" WHERE id = $1`, [userid]);
                    if (users.length > 0) {
                        const { firstname, lastname, othernames } = users[0];
                        accountName = `${firstname} ${lastname} ${othernames}`.trim();
                    }
                }
            } else if (whichaccount == 'PROPERTY') {
                const { rows: propertyAccounts } = await pg.query(`SELECT productid FROM skyeu."propertyaccount" WHERE accountnumber = $1`, [accountnumber]);
                if (propertyAccounts.length > 0) {
                    const { userid } = propertyAccounts[0];
                    const { rows: theuser } = await pg.query(`SELECT firstname, lastname, othernames FROM skyeu."User" WHERE id = $1`, [userid]);
                    if (theuser.length > 0) {
                        const { firstname, lastname, othernames } = theuser[0];
                        accountName = `${firstname} ${lastname} ${othernames}`.trim();
                    }
                }
            } else if (whichaccount == 'ROTARY') {
                const { rows: rotaryAccounts } = await pg.query(`SELECT userid FROM skyeu."rotaryaccount" WHERE accountnumber = $1`, [accountnumber]);
                if (rotaryAccounts.length > 0) {
                    const { userid } = rotaryAccounts[0];
                    const { rows: theuser } = await pg.query(`SELECT firstname, lastname, othernames FROM skyeu."User" WHERE id = $1`, [userid]);
                    if (theuser.length > 0) {
                        const { firstname, lastname, othernames } = theuser[0];
                        accountName = `${firstname} ${lastname} ${othernames}`.trim();
                    }
                }
            } else if (whichaccount == 'GLACCOUNT') {
                const { rows: glAccounts } = await pg.query(`SELECT accountnumber FROM skyeu."Accounts" WHERE accountnumber = $1`, [accountnumber]);
                if (glAccounts.length > 0) {
                    accountName = glAccounts[0].groupname;
                }
            } 

            transaction.accountname = accountName;
        }

        // Get total count for pagination
        const countQuery = {
            text: `SELECT COUNT(*) FROM skyeu."transaction" ${whereClause}`,
            values: query.values.slice(0, -2) // Exclude limit and offset
        };
        const { rows: [{ count: total }] } = await pg.query(countQuery);
        const pages = divideAndRoundUp(total, limit);

        await activityMiddleware(req, user.id, 'Transactions fetched successfully', 'TRANSACTION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Transactions fetched successfully",
            statuscode: StatusCodes.OK,
            data: transactions,
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

module.exports = { getTransactions };
