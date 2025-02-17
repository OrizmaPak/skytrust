const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { autoAddMembershipAndAccounts } = require("../../../middleware/autoaddmembershipandaccounts");

const fixmembershipforallusers = async (req, res) => {
    const user = req.user;

    try {
        // Fetch all users
        const { rows: users } = await pg.query(`SELECT * FROM sky."User"`);

        // Loop through each user and call the necessary membership function
        for (const user of users) {
            req.newuser = user
            // Assuming there's a function to handle membership logic for each user
            await autoAddMembershipAndAccounts(req, res);
        }


        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Memberships processed successfully for all users",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error('Unexpected Error:', error);
        await activityMiddleware(req, user.id, 'An unexpected error occurred processing memberships', 'MEMBERSHIP');

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

// Placeholder for the function that handles membership logic for each user
async function handleUserMembership(user) {
    // Implement the necessary logic here
    console.log(`Processing membership for user: ${user.id}`);
}



module.exports = { fixmembershipforallusers };
