const pg = require("../db/pg");

const autoAddMembershipAndAccounts = async (req, res, user = 0, db = pg) => {
    try {
        const userId = req.newuser.id;
        const userBranch = req.newuser.branch || req.body.branch || 1;
        const registrationPoint = req.newuser.registrationpoint || 0;
        const createdAt = new Date();

        const { rows: defineMembers } = await db.query(`
            SELECT id
            FROM skytobi."DefineMember"
            WHERE addmember = 'YES'
        `);

        let membershipsCreated = 0;
        for (const defineMember of defineMembers) {
            const { rows: existingMembership } = await db.query(`
                SELECT id
                FROM skytobi."Membership"
                WHERE userid = $1 AND member = $2
            `, [userId, defineMember.id]);

            if (existingMembership.length === 0) {
                await db.query(`
                    INSERT INTO skytobi."Membership" (member, userid, createdby, status)
                    VALUES ($1, $2, $3, 'ACTIVE')
                `, [defineMember.id, userId, userId]);
                membershipsCreated += 1;
            }
        }

        const { rows: savingsProducts } = await db.query(`
            SELECT id
            FROM skytobi."savingsproduct"
            WHERE addmember = 'YES' AND status = 'ACTIVE'
            ORDER BY id ASC
        `);

        let accountsCreated = 0;
        if (savingsProducts.length > 0) {
            const { rows: [orgSettings] } = await db.query(`
                SELECT savings_account_prefix
                FROM skytobi."Organisationsettings"
                WHERE status = 'ACTIVE'
                LIMIT 1
            `);

            if (!orgSettings?.savings_account_prefix) {
                throw new Error("Savings account prefix not set in organisation settings.");
            }

            const { rows: [latestAccount] } = await db.query(`
                SELECT accountnumber
                FROM skytobi."savings"
                WHERE accountnumber::text LIKE $1
                ORDER BY accountnumber DESC
                LIMIT 1
            `, [`${orgSettings.savings_account_prefix}%`]);

            let nextAccountNumber = latestAccount
                ? Number(latestAccount.accountnumber) + 1
                : Number(`${orgSettings.savings_account_prefix}${'0'.repeat(10 - String(orgSettings.savings_account_prefix).length - 1)}1`);

            for (const product of savingsProducts) {
                const { rows: [existingAccount] } = await db.query(`
                    SELECT id
                    FROM skytobi."savings"
                    WHERE userid = $1 AND savingsproductid = $2 AND member = 0 AND status = 'ACTIVE'
                `, [userId, product.id]);

                if (existingAccount) {
                    continue;
                }

                await db.query(`
                    INSERT INTO skytobi."savings"
                    (
                        savingsproductid, accountnumber, userid, amount, branch, registrationpoint,
                        registrationcharge, registrationdate, registrationdesc, accountofficer,
                        sms, whatsapp, email, status, dateadded, createdby, member
                    )
                    VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ACTIVE', $14, $15, 0)
                `, [
                    product.id,
                    String(nextAccountNumber),
                    userId,
                    0,
                    userBranch,
                    registrationPoint,
                    0,
                    createdAt,
                    'Automatically created during signup',
                    String(userId),
                    false,
                    false,
                    false,
                    createdAt,
                    userId
                ]);

                nextAccountNumber += 1;
                accountsCreated += 1;
            }
        }

        return {
            status: true,
            membershipsCreated,
            accountsCreated
        };
    } catch (error) {
        console.error('Error in autoAddMembershipAndAccounts middleware:', error);
        return {
            status: false,
            membershipsCreated: 0,
            accountsCreated: 0,
            error: error.message
        };
    }
};

module.exports = { autoAddMembershipAndAccounts };
