const pg = require("../db/pg");

const autoAddMembershipAndAccounts = async (req, res, user=0) => {
    try {
        const userId = req.newuser.id;
        // if (!req.user) {
        //     req.user.id = 0
        //     // console.error('User information is missing in the request.');
        //     // return false;
        // }

        // Fetch all DefineMember rows with addmember set to 'YES'
        const { rows: defineMembers } = await pg.query(`SELECT id FROM sky."DefineMember" WHERE addmember = 'YES'`);
 
        // Iterate over each DefineMember and create a Membership entry if it doesn't exist
        for (const defineMember of defineMembers) { 
            const memberId = defineMember.id;

            // Check if a membership already exists for this user and member
            const { rows: existingMembership } = await pg.query(
                `SELECT id FROM sky."Membership" WHERE userid = $1 AND member = $2`,
                [userId, memberId]
            );

            // If no existing membership, create a new one
            if (existingMembership.length === 0) {
                await pg.query(
                    `INSERT INTO sky."Membership" (member, userid, createdby, status) VALUES ($1, $2, $3, 'ACTIVE')`,
                    [memberId, userId, userId]
                );
            }
        }

        return true;
    } catch (error) {
        console.error('Error in autoAddMembershipAndAccounts middleware:', error);
        return false
    }
};

module.exports = {autoAddMembershipAndAccounts};
