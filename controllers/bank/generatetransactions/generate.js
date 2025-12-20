const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const generateTransactions = async (req, res) => {
    const { accountnumber, startdate, enddate, totalamount, estimatedamount, creditsno, debitsno, userid, branch } = req.body;
    const user = req.user;

    const parsedEstimate = Number(estimatedamount ?? totalamount);
    const creditCount = Number(creditsno);
    const debitCount = Number(debitsno);
    const minimumPerTransaction = 5; // dollars

    const estimateMissing = !Number.isFinite(parsedEstimate) || parsedEstimate <= 0;
    const creditCountMissing = !Number.isInteger(creditCount) || creditCount < 0;
    const debitCountMissing = !Number.isInteger(debitCount) || debitCount < 0;

    if (!accountnumber || !startdate || !enddate || estimateMissing || creditCountMissing || debitCountMissing) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Missing required fields",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["accountnumber, startdate, enddate, estimatedamount (> 0), creditsno, and debitsno are required"]
        });
    }

    try {
        const splitAmountIntoTransactions = (total, count, minValue) => {
            if (count === 0) return [];

            const minCents = Math.round(minValue * 100);
            let totalCents = Math.round(total * 100);

            // Ensure we have at least the minimum for each transaction
            totalCents = Math.max(totalCents, minCents * count);

            // Allocate the minimum first
            let remainingCents = totalCents - minCents * count;

            // Generate random weights to create varied amounts (skewed for “lumpy” values)
            const weights = Array.from({ length: count }, () => Math.pow(Math.random(), 1.5) + 0.2);
            const weightSum = weights.reduce((s, w) => s + w, 0);

            const allocations = weights.map((w) => Math.floor((w / weightSum) * remainingCents) + minCents);

            // Distribute any leftover cents randomly to keep totals exact
            let allocatedCents = allocations.reduce((s, c) => s + c, 0);
            let leftovers = totalCents - allocatedCents;
            while (leftovers > 0) {
                const idx = Math.floor(Math.random() * allocations.length);
                allocations[idx] += 1;
                leftovers -= 1;
            }

            return allocations.map((cents) => Number((cents / 100).toFixed(2)));
        };

        const buildTargetTotal = (count) => {
            if (count === 0) return 0;
            const base = Math.max(parsedEstimate, minimumPerTransaction * count);
            const multiplier = 2.5 + Math.random() * 3.5; // between 2.5x and 6x to make values feel “big”
            return base * multiplier;
        };

        const descriptions = [
            "Shopping at the local mall for clothing and accessories",
            "Business transaction involving client invoice settlement",
            "Online purchase of electronics and gadgets",
            "Utility bill payment for electricity and water services",
            "Grocery shopping at the neighborhood supermarket",
            "Dining out at a fine restaurant with family",
            "Travel expenses for a business trip to New York",
            "Monthly salary credit from employer",
            "Freelance payment for web development project",
            "Loan repayment for personal loan from bank",
            "Subscription renewal for streaming services",
            "Medical bill payment for routine check-up",
            "Gym membership fee for annual subscription",
            "Charity donation to local non-profit organization",
            "Home renovation expenses for kitchen upgrade",
            "Car maintenance and repair costs",
            "Educational course fee for online learning",
            "Pet care and veterinary services payment",
            "Insurance premium for health coverage",
            "Investment in stocks and mutual funds",
            "Payment for online gaming subscription",
            "Purchase of concert tickets for live event",
            "Monthly rent payment for apartment",
            "Tuition fee payment for university semester",
            "Purchase of home office furniture",
            "Payment for professional certification exam",
            "Donation to environmental conservation fund",
            "Purchase of art supplies for hobby",
            "Payment for language learning course",
            "Annual subscription for cloud storage service",
            "Payment for digital marketing services",
            "Purchase of new smartphone and accessories",
            "Payment for car insurance premium",
            "Purchase of airline tickets for vacation",
            "Payment for home cleaning services",
            "Purchase of gardening tools and supplies",
            "Payment for personal trainer sessions",
            "Purchase of winter clothing and gear",
            "Payment for music streaming service",
            "Purchase of kitchen appliances and utensils",
            "Payment for photography workshop",
            "Purchase of camping equipment for outdoor trip",
            "Payment for online fitness classes",
            "Purchase of luxury watch as a gift",
            "Payment for spa and wellness retreat",
            "Purchase of books and educational materials",
            "Payment for graphic design services",
            "Purchase of sports equipment for training",
            "Payment for wedding planning services",
            "Purchase of baby products and essentials"
        ];

        const generateRandomDate = (start, end) => {
            return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
        };

        const generateReferencer = () => {
            const prefix = 'REF';
            const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
            const timestamp = Date.now().toString(36).toUpperCase();
            const accountPart = accountnumber.toString().slice(-4);

            return `${prefix}-${accountPart}-${randomPart}-${timestamp}`;
        };

        const transactions = [];
        const creditAmounts = splitAmountIntoTransactions(buildTargetTotal(creditCount), creditCount, minimumPerTransaction);
        const debitAmounts = splitAmountIntoTransactions(buildTargetTotal(debitCount), debitCount, minimumPerTransaction);

        for (let i = 0; i < creditAmounts.length; i++) {
            const creditAmount = creditAmounts[i];

            let ref = generateReferencer()

            let thedate = generateRandomDate(new Date(startdate), new Date(enddate))

            transactions.push({
                accountnumber,
                userid, // Assuming userid is not provided in this context
                currency: "USD",
                credit: creditAmount,
                debit: 0,
                description: descriptions[Math.floor(Math.random() * descriptions.length)],
                image: null, // Assuming image is not provided in this context
                branch, // Assuming branch is not provided in this context
                registrationpoint: 0, // Assuming registrationpoint is not provided in this context
                dateadded: thedate, // Default to current date
                approvedby: null, // Assuming approvedby is not provided in this context
                status: "ACTIVE", // Default status
                updateddated: null, // Assuming updateddated is not provided in this context
                transactiondate: thedate,
                transactiondesc: null, // Assuming transactiondesc is not provided in this context
                transactionref: "", // Default to empty string
                cashref: null, // Assuming cashref is not provided in this context
                updatedby: null, // Assuming updatedby is not provided in this context
                ttype: "CREDIT", // Assuming ttype is not provided in this context
                tfrom: "BANK", // Assuming tfrom is not provided in this context
                createdby: 0, // Default to 0
                valuedate: thedate, // Assuming valuedate is not provided in this context
                reference: ref, // Assuming reference is not provided in this context
                whichaccount: "SAVINGS", // Assuming whichaccount is not provided in this context
                voucher: "", // Default to empty string
                tax: false // Default to false
            });
        }


        for (let i = 0; i < debitAmounts.length; i++) {
            const debitAmount = debitAmounts[i];

            let ref = generateReferencer()

            let thedate = generateRandomDate(new Date(startdate), new Date(enddate))

            transactions.push({
                accountnumber,
                userid, // Assuming userid is not provided in this context
                currency: "USD",
                credit: 0,
                debit: debitAmount,  
                description: descriptions[Math.floor(Math.random() * descriptions.length)],
                image: null, // Assuming image is not provided in this context
                branch: null, // Assuming branch is not provided in this context
                registrationpoint: null, // Assuming registrationpoint is not provided in this context
                dateadded: thedate, // Default to current date
                approvedby: null, // Assuming approvedby is not provided in this context
                status: "ACTIVE", // Default status
                updateddated: null, // Assuming updateddated is not provided in this context
                transactiondate: thedate,
                transactiondesc: null, // Assuming transactiondesc is not provided in this context
                transactionref: "", // Default to empty string
                cashref: null, // Assuming cashref is not provided in this context
                updatedby: null, // Assuming updatedby is not provided in this context
                ttype: "DEBIT", // Assuming ttype is not provided in this context
                tfrom: "BANK", // Assuming tfrom is not provided in this context
                createdby: 0, // Default to 0
                valuedate: null, // Assuming valuedate is not provided in this context
                reference: ref, // Assuming reference is not provided in this context
                whichaccount: 'SAVINGS', // Assuming whichaccount is not provided in this context
                voucher: "", // Default to empty string
                tax: false // Default to false
            });
        }

        // Save transactions to the database
        // const client = await pg.connect();
        try {
            await pg.query('BEGIN');
            for (const transaction of transactions) {
                const query = `
                    INSERT INTO sky."transaction" (
                        accountnumber, 
                        userid, 
                        currency, 
                        credit, 
                        debit, 
                        description, 
                        image, 
                        branch, 
                        registrationpoint, 
                        dateadded, 
                        approvedby, 
                        status, 
                        updateddated, 
                        transactiondate, 
                        transactiondesc, 
                        transactionref, 
                        cashref, 
                        updatedby, 
                        ttype, 
                        tfrom, 
                        createdby, 
                        valuedate, 
                        reference, 
                        whichaccount, 
                        voucher, 
                        tax
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
                    )
                `;
                const values = [
                    transaction.accountnumber,
                    transaction.userid || null,
                    transaction.currency,
                    transaction.credit,
                    transaction.debit,
                    transaction.description,
                    transaction.image || null,
                    transaction.branch || null,
                    transaction.registrationpoint || null,
                    transaction.dateadded || new Date(),
                    transaction.approvedby || null,
                    transaction.status || 'ACTIVE',
                    transaction.updateddated || null,
                    transaction.transactiondate,
                    transaction.transactiondesc || null,
                    transaction.transactionref || '',
                    transaction.cashref || '',
                    transaction.updatedby || null,
                    transaction.ttype || null,
                    transaction.tfrom || null,
                    transaction.createdby || 0,
                    transaction.valuedate || null,
                    transaction.reference || null,
                    transaction.whichaccount || "SAVINGS",
                    transaction.voucher || '',
                    transaction.tax || false
                ];
                await pg.query(query, values);
            }
            await pg.query('COMMIT');
        } catch (error) {
            await pg.query('ROLLBACK');
            throw error;
        }

        await activityMiddleware(req, user.id, 'Transactions generated successfully', 'TRANSACTION');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Transactions generated successfully",
            statuscode: StatusCodes.OK,
            data: transactions,
            errors: []
        });
    } catch (error) {
        const isSmallAmountError = error.message?.includes('Total amount is too small');
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred generating transactions', 'TRANSACTION');

        return res.status(isSmallAmountError ? StatusCodes.BAD_REQUEST : StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: isSmallAmountError ? error.message : "An unexpected error occurred",
            statuscode: isSmallAmountError ? StatusCodes.BAD_REQUEST : StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { generateTransactions };
