const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

/**
 * Fetches loan accounts with optional filtering and pagination.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getLoanAccount = async (req, res) => {
    const user = req.user;  

    try {
        // Base SQL query without WHERE and LIMIT/OFFSET
        let baseQuery = `
            SELECT 
                la.id,
                la.userid,
                la.accountofficer,
                la.loanproduct,
                la.member,
                la.branch,
                la.registrationpoint,
                la.numberofrepayments,
                la.duration,
                la.interestrate,
                la.registrationcharge,
                la.defaultpenaltyid,
                la.seperateinterest,
                la.registrationdate,
                la.dateadded,
                la.dateclosed,
                la.closeamount,
                la.createdby,
                la.disbursementref,
                la.accountnumber,
                la.registrationdesc,
                la.bankname1,
                la.bankaccountname1,
                la.bankaccountnumber1,
                la.bankname2,
                la.bankaccountname2,
                la.bankaccountnumber2,
                la.repaymentfrequency,
                la.durationcategory,
                la.interestmethod,
                la.interestratetype,
                la.status,
                la.loanamount,

                CONCAT(u1.firstname, ' ', u1.lastname, ' ', COALESCE(u1.othernames, '')) AS useridname,
                CONCAT(
                    COALESCE(u2.firstname, ''), ' ', 
                    COALESCE(u2.lastname, ''), ' ', 
                    COALESCE(u2.othernames, '')
                ) AS accountofficername,
                lp.productname AS loanproductname,
                row_to_json(lp) AS productdetails,
                dm.member AS membername,
                br.branch AS branchname,
                COALESCE(rp.registrationpoint, 'N/A') AS registrationpointname,
                COALESCE(json_agg(c) FILTER (WHERE c.id IS NOT NULL), '[]') AS collaterals
            FROM sky."loanaccounts" la
            JOIN sky."User" u1 ON la.userid::text = u1.id::text
            LEFT JOIN sky."User" u2 ON la.accountofficer::text = u2.id::text
            JOIN sky."loanproduct" lp ON la.loanproduct::text = lp.id::text
            JOIN sky."DefineMember" dm ON la.member::text = dm.id::text
            JOIN sky."Branch" br ON la.branch::text = br.id::text
            LEFT JOIN sky."Registrationpoint" rp ON la.registrationpoint::text = rp.id::text
            LEFT JOIN sky."collateral" c ON la.accountnumber::text = c.accountnumber::text
        `;

        // Initialize WHERE clauses and parameters
        let whereClauses = [];
        let queryValues = [];
        let valueIndex = 1; // PostgreSQL parameter indexing starts at 1

        // Define filterable fields
        const filterableFields = [
            'numberofrepayments', 'duration', 'branch', 'registrationpoint',
            'interestrate', 'registrationcharge', 'defaultpenaltyid',
            'seperateinterest', 'registrationdate', 'dateadded', 'dateclosed',
            'closeamount', 'createdby', 'member', 'id', 'loanproduct',
            'loanamount', 'userid', 'disbursementref', 'accountnumber',
            'registrationdesc', 'bankname1', 'bankaccountname1',
            'bankaccountnumber1', 'bankname2', 'bankaccountname2',
            'bankaccountnumber2', 'accountofficer', 'repaymentfrequency',
            'durationcategory', 'interestmethod', 'interestratetype', 'status'
        ];

        // Dynamically build the WHERE clause based on query parameters (excluding 'q')
        filterableFields.forEach((field) => {
            if (req.query[field] !== undefined) {
                whereClauses.push(`la."${field}" = $${valueIndex}`);
                queryValues.push(req.query[field]);
                valueIndex++;
            }
        });

        // Note: Removed 'q' from SQL query's WHERE clause

        // Combine all WHERE clauses
        let whereClause = '';
        if (whereClauses.length > 0) {
            whereClause = 'WHERE ' + whereClauses.join(' AND ');
        }

        // Complete the base query with WHERE clause
        baseQuery += `\n${whereClause}`;

        // Group by la.id and all non-aggregated selected columns
        // Since we're aggregating collaterals, ensure la.id is unique
        baseQuery += `
            GROUP BY 
                la.id, 
                u1.firstname, 
                u1.lastname, 
                u1.othernames, 
                u2.firstname, 
                u2.lastname, 
                u2.othernames, 
                lp.productname, 
                dm.member, 
                br.branch, 
                rp.registrationpoint, 
                lp.id
        `;

        // Add pagination
        const searchParams = new URLSearchParams(req.query);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || process.env.DEFAULT_LIMIT || '100', 10); // Fallback to 100 if DEFAULT_LIMIT is undefined
        const offset = (page - 1) * limit;

        baseQuery += `\nLIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
        queryValues.push(limit, offset);
        valueIndex += 2;

        // Finalize the query
        const finalQuery = {
            text: baseQuery,
            values: queryValues
        };

        // Debugging: Log the final query and values
        console.log('Executing query:', finalQuery.text);
        console.log('With values:', finalQuery.values);

        // Execute the main query
        const result = await pg.query(finalQuery);
        let loanAccounts = result.rows;

        // Apply 'q' filtering after fetching the results
        if (req.query.q) {
            const q = req.query.q.toLowerCase();

            // Define which fields to search in the application layer
            const searchableFields = [
                'numberofrepayments', 'duration', 'branch', 'registrationpoint',
                'interestrate', 'registrationcharge', 'defaultpenaltyid',
                'seperateinterest', 'registrationdate', 'dateadded', 'dateclosed',
                'closeamount', 'createdby', 'member', 'id', 'loanproduct',
                'loanamount', 'userid', 'disbursementref', 'accountnumber',
                'registrationdesc', 'bankname1', 'bankaccountname1',
                'bankaccountnumber1', 'bankname2', 'bankaccountname2',
                'bankaccountnumber2', 'accountofficer', 'repaymentfrequency',
                'durationcategory', 'interestmethod', 'interestratetype', 'status',
                'useridname', 'accountofficername', 'loanproductname', 'membername',
                'branchname', 'registrationpointname'
                // Add any additional fields you want to include in the search
            ];

            loanAccounts = loanAccounts.filter(account => {
                return searchableFields.some(field => {
                    const fieldValue = account[field];
                    if (fieldValue && typeof fieldValue === 'string') {
                        return fieldValue.toLowerCase().includes(q);
                    }
                    return false;
                });
            });

            // Adjust total based on filtered results
            // Fetch total without pagination but with initial filters
            const totalFiltered = loanAccounts.length;
            const pages = divideAndRoundUp(totalFiltered, limit);

            // Optionally, you can re-paginate the filtered results
            // But this would require fetching all filtered data, which can be heavy
            // Instead, you might consider applying the 'q' filter in the SQL query for better performance
            // If you still prefer post-fetch filtering, proceed as follows:

            // Slice the filtered results for pagination
            const paginatedAccounts = loanAccounts.slice(offset, offset + limit);

            // Get total count for pagination based on filtered results
            const total = totalFiltered;
            const pagesCount = divideAndRoundUp(Number(total), limit);

            // Log activity
            await activityMiddleware(req, user.id, 'Loan accounts fetched successfully with search', 'LOAN_ACCOUNT');

            // Respond with data and pagination info
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Loan accounts fetched successfully",
                statuscode: StatusCodes.OK,
                data: paginatedAccounts,
                pagination: {
                    total: Number(total),
                    pages: pagesCount,
                    page,
                    limit
                },
                errors: []
            });
        }

        // If 'q' is not present, proceed with the original pagination
        // Get total count for pagination without 'q'
        const countQueryText = `
            SELECT COUNT(DISTINCT la.id) AS total
            FROM sky."loanaccounts" la
            JOIN sky."User" u1 ON la.userid::text = u1.id::text
            LEFT JOIN sky."User" u2 ON la.accountofficer::text = u2.id::text
            JOIN sky."loanproduct" lp ON la.loanproduct::text = lp.id::text
            JOIN sky."DefineMember" dm ON la.member::text = dm.id::text
            JOIN sky."Branch" br ON la.branch::text = br.id::text
            LEFT JOIN sky."Registrationpoint" rp ON la.registrationpoint::text = rp.id::text
            LEFT JOIN sky."collateral" c ON la.accountnumber::text = c.accountnumber::text
            ${whereClause}
        `;

        const countQuery = {
            text: countQueryText,
            values: queryValues.slice(0, valueIndex - 3) // Exclude LIMIT and OFFSET
        };

        const countResult = await pg.query(countQuery);
        const total = countResult.rows[0].total || 0;
        const pages = divideAndRoundUp(Number(total), limit);

        // Log activity
        await activityMiddleware(req, user.id, 'Loan accounts fetched successfully', 'LOAN_ACCOUNT');

        // Respond with data and pagination info
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Loan accounts fetched successfully",
            statuscode: StatusCodes.OK,
            data: loanAccounts,
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
        await activityMiddleware(req, user.id, 'An unexpected error occurred fetching loan accounts', 'LOAN_ACCOUNT');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getLoanAccount };
