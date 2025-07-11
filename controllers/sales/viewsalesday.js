const { StatusCodes } = require("http-status-codes");
const pg = require("../../db/pg");

const viewSalesByDay = async (req, res) => {
    const { userid, date, branch } = req.query;
    
    if (!date) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Date is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Date is required"]
        });
    }

    try {
        // Base query with necessary joins
        let inventoryQuery = {
            text: `
                SELECT I.*
                FROM skyeu."Inventory" I
                JOIN skyeu."transaction" T ON I."reference" = T."transactionref"
                JOIN skyeu."User" U ON T."userid" = U."id"
                WHERE I."transactiondesc" = 'DEP-SALES'
                AND I."transactiondate"::date = $1
            `,
            values: [date]
        };

        // Add filters based on parameters
        const params = [date];
        if (userid) {
            inventoryQuery.text += ` AND T."userid" = $${params.length + 1}`;
            params.push(userid);
        }
        if (branch) {
            inventoryQuery.text += ` AND U."branch" = $${params.length + 1}`;
            params.push(branch);
        }
        inventoryQuery.values = params;

        const { rows: inventoryRows } = await pg.query(inventoryQuery);

        // Group inventory items by reference
        const groupedInventory = inventoryRows.reduce((acc, item) => {
            acc[item.reference] = acc[item.reference] || { items: [], transaction: null };
            acc[item.reference].items.push(item);
            return acc;
        }, {});

        // Get branch information
        let branchName = 'Unknown Branch';
        if (branch) {
            const branchRes = await pg.query({
                text: `SELECT branch FROM skyeu."Branch" WHERE id = $1`,
                values: [branch]
            });
            branchName = branchRes.rows[0]?.branch || branchName;
        } else if (userid) {
            const branchRes = await pg.query({
                text: `
                    SELECT B.branch 
                    FROM skyeu."Branch" B
                    JOIN skyeu."User" U ON B.id = U.branch
                    WHERE U.id = $1
                `,
                values: [userid]
            });
            branchName = branchRes.rows[0]?.branch || branchName;
        }

        // Process transactions with credit/debit summation
        const transactionPromises = Object.keys(groupedInventory).map(async (reference) => {
            try {
                // Get all transactions for this reference
                const transactionRes = await pg.query({
                    text: `SELECT * FROM skyeu."transaction" WHERE transactionref = $1`,
                    values: [reference]
                });

                if (!transactionRes.rows.length) {
                    return { reference, transaction: null };
                }

                // Calculate total credit and debit
                const totals = transactionRes.rows.reduce((acc, txn) => ({
                    credit: acc.credit + Number(txn.credit),
                    debit: acc.debit + Number(txn.debit)
                }), { credit: 0, debit: 0 });

                // Use first transaction for metadata
                const baseTransaction = transactionRes.rows[0];
                const amountPaid = totals.credit - totals.debit;

                // Get cashier details
                const userRes = await pg.query({
                    text: `SELECT firstname, lastname, othernames FROM skyeu."User" WHERE id = $1`,
                    values: [baseTransaction.userid]
                });
                
                const cashier = userRes.rows[0] 
                    ? [userRes.rows[0].firstname, userRes.rows[0].lastname, userRes.rows[0].othernames]
                        .filter(Boolean).join(' ')
                    : 'Unknown Cashier';

                return {
                    reference,
                    transaction: {
                        ...baseTransaction,
                        amountpaid: amountPaid,
                        total_credit: totals.credit,
                        total_debit: totals.debit,
                        cashier,
                        branchname: branchName
                    }
                };
            } catch (error) {
                console.error(`Error processing transaction ${reference}:`, error);
                return { reference, transaction: null };
            }
        });

        const transactions = await Promise.all(transactionPromises);
        
        // Merge transactions with inventory groups
        transactions.forEach(({ reference, transaction }) => {
            if (groupedInventory[reference]) {
                groupedInventory[reference].transaction = transaction;
            }
        });

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Sales data fetched successfully",
            statuscode: StatusCodes.OK,
            data: groupedInventory,
            errors: []
        });

    } catch (error) {
        console.error('Error fetching sales data:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal server error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { viewSalesByDay };