    const { StatusCodes } = require("http-status-codes");
    const pg = require("../../../db/pg");
    const { activityMiddleware } = require("../../../middleware/activity");
    const { divideAndRoundUp } = require("../../../utils/pageCalculator");
    
    const getAccountsAndSchedules = async (req, res) => {
        const user = req.user;
        try {
            // Fetch accounts with pagination
            const searchParams = new URLSearchParams(req.query);
            const page = parseInt(searchParams.get('page') || '1', 10);
            const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT, 10);
            const offset = (page - 1) * limit;
    
            let query = {
                text: `SELECT * FROM sky."rotaryaccount"`,
                values: []
            };
    
            // Dynamically build the WHERE clause based on query parameters
            let whereClause = '';
            let valueIndex = 1;
            Object.keys(req.query).forEach((key) => {
                const value = req.query[key];
                if (['q', 'page', 'limit', 'startdate', 'enddate'].includes(key)) {
                    // Skip these keys for general filtering
                    return;
                }
                if (value) {
                    if (whereClause) {
                        whereClause += ` AND `;
                    } else {
                        whereClause += ` WHERE `;
                    }
                    whereClause += `"${key}" = $${valueIndex}`;
                    query.values.push(value);
                    valueIndex++;
                }
            });
    
            // Add date range filter if provided
            if (req.query.startdate) {
                const startDate = req.query.startdate;
                if (startDate) {
                    if (whereClause) {
                        whereClause += ` AND `;
                    } else {
                        whereClause += ` WHERE `;
                    }
                    whereClause += `"dateadded" >= $${valueIndex}`;
                    query.values.push(startDate);
                    valueIndex++;
                }
            }
    
            if (req.query.enddate) {
                const endDate = req.query.enddate;
                if (endDate) {
                    if (whereClause) {
                        whereClause += ` AND `;
                    } else {
                        whereClause += ` WHERE `;
                    }
                    whereClause += `"dateadded" <= $${valueIndex}`;
                    query.values.push(endDate);
                    valueIndex++;
                }
            }
    
            // Add search query if provided
            if (req.query.q) {
                const searchConditions = [
                    `accountnumber ILIKE $${valueIndex}`,
                    `registrationdesc ILIKE $${valueIndex}`
                ].join(' OR ');
                if (whereClause) {
                    whereClause += ` AND (${searchConditions})`;
                } else {
                    whereClause += ` WHERE (${searchConditions})`;
                }
                query.values.push(`%${req.query.q}%`);
                valueIndex++;
            }
    
            query.text += whereClause + ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
            query.values.push(limit, offset);
    
            const accountResult = await pg.query(query);
            const accounts = accountResult.rows;
    
            // Get total count for pagination
            const countQuery = {
                text: `SELECT COUNT(*) FROM sky."rotaryaccount" ${whereClause}`,
                values: query.values.slice(0, -2) // Exclude limit and offset
            };
            const { rows: [{ count: total }] } = await pg.query(countQuery);
            const pages = divideAndRoundUp(total, limit);
    
            // Process each account to fetch its schedules, transactions, and additional details
            const processedAccounts = await Promise.all(accounts.map(async (account) => {
                const accountNumber = account.accountnumber;
                const userId = account.userid;
                const registrationPoint = account.registrationpoint;
                const productId = account.productid;
                const memberId = account.member;
                const branchId = account.branch;
    
                // Fetch user details to construct account name
                const userQuery = {
                    text: `SELECT firstname, lastname, othernames FROM sky."User" WHERE id = $1`,
                    values: [userId]
                };
                const userResult = await pg.query(userQuery);
                const userDetails = userResult.rows[0];
                const accountName = `${userDetails.firstname} ${userDetails.lastname} ${userDetails.othernames || ''}`.trim();
    
                // Fetch registration point name
                const registrationPointQuery = {
                    text: `SELECT registrationpoint AS name FROM sky."Registrationpoint" WHERE id = $1`,
                    values: [registrationPoint]
                };
                const registrationPointResult = await pg.query(registrationPointQuery);
                const registrationPointName = registrationPointResult.rows[0]?.name || '';
    
                // Fetch product name
                const productQuery = {
                    text: `SELECT product AS productname FROM sky."rotaryProduct" WHERE id = $1`,
                    values: [productId]
                };
                const productResult = await pg.query(productQuery);
                console.log('productResult', productResult.rows[0]);
                const productName = productResult.rows[0]?.productname || '';
    
                // Fetch member name
                const memberQuery = {
                    text: `SELECT member AS membername FROM sky."DefineMember" WHERE id = $1`,
                    values: [memberId]
                };
                const memberResult = await pg.query(memberQuery);
                const memberName = memberResult.rows[0]?.membername || '';
    
                // Fetch branch name
                const branchQuery = {
                    text: `SELECT branch AS branchname FROM sky."Branch" WHERE id = $1`,
                    values: [branchId]
                };
                const branchResult = await pg.query(branchQuery);
                const branchName = branchResult.rows[0]?.branchname || '';
    
                // Fetch schedules for the account sorted by due date
                const scheduleQuery = {
                    text: `
                        SELECT * FROM sky."rotaryschedule" 
                        WHERE accountnumber = $1 AND status = 'ACTIVE'
                        ORDER BY duedate ASC
                    `,
                    values: [accountNumber]
                };
                const scheduleResult = await pg.query(scheduleQuery);
                const schedules = scheduleResult.rows;
    
                // Fetch transactions for the account
                const transactionQuery = {
                    text: `
                        SELECT SUM(credit) AS total_credit 
                        FROM sky."transaction" 
                        WHERE accountnumber = $1 AND status = 'ACTIVE' 
                    `,
                    values: [accountNumber]
                };
                const transactionResult = await pg.query(transactionQuery);
                const totalCredit = transactionResult.rows[0].total_credit || 0;
    
                // Initialize variables to track remaining credit and total remaining amount
                let remainingCredit = totalCredit;
                let totalRemainingAmount = 0;
                let nextDueDate = null;
    
                // Process each schedule and distribute the credit
                const processedSchedules = schedules.map((schedule) => {
                    const { amount, payout, duedate } = schedule;
    
                    let amountPaid = Math.min(amount, remainingCredit);
                    let remainingAmount = amount - amountPaid;
    
                    remainingCredit -= amountPaid;
                    totalRemainingAmount += remainingAmount;
    
                    let paymentStatus;
                    if (amountPaid === amount) {
                        paymentStatus = "PAID";
                    } else if (amountPaid > 0 && amountPaid < amount) {
                        paymentStatus = "PARTLY PAID";
                    } else {
                        paymentStatus = "UNPAID";
                    }
    
                    let scheduleStatus;
                    const dueDate = new Date(duedate);
                    const today = new Date();
    
                    if (payout === "YES") {
                        if (paymentStatus === "PAID" && dueDate <= today) {
                            scheduleStatus = "READY FOR PAYOUT";
                        } else {
                            scheduleStatus = "PAYOUT NOT DUE";
                        }
                    } else {
                        if (paymentStatus === "PAID") {
                            scheduleStatus = "DUE AND PAID";
                        } else if (dueDate <= today) {
                            scheduleStatus = "DUE FOR PAYMENT";
                        } else {
                            const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                            scheduleStatus = `DUE IN ${daysLeft} DAYS LEFT`;
    
                            // Update next due date if it's the earliest upcoming due date
                            if (!nextDueDate || dueDate < nextDueDate) {
                                nextDueDate = dueDate;
                            }
                        }
                    }
    
                    return {
                        ...schedule,
                        amountPaid,
                        paymentStatus,
                        scheduleStatus,
                        remainingAmount
                    };
                });
    
                return {
                    ...account,
                    accountname: accountName,
                    registrationpointname: registrationPointName,
                    productname: productName,
                    membername: memberName,
                    branchname: branchName,
                    schedules: processedSchedules,
                    totalRemainingAmount, // Add total remaining amount to the account
                    nextduedate: nextDueDate // Add next due date to the account
                };
            }));
    
            await activityMiddleware(req, user.id, 'Accounts and schedules fetched successfully', 'ROTARY_ACCOUNT_FETCH');
    
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Accounts and schedules fetched successfully",
                statuscode: StatusCodes.OK,
                data: processedAccounts,
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
            await activityMiddleware(req, user.id, 'An unexpected error occurred fetching accounts and schedules', 'ROTARY_ACCOUNT_ERROR');
    
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: "An unexpected error occurred",
                statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
                data: null,
                errors: [error.message]
            });
        }
    }; 
    
    module.exports = { getAccountsAndSchedules };