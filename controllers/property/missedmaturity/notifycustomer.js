const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

/**
 * POST /notifycustomer
 * Body: { duedate, amount, remaining, itemid, itemname, userid }
 *
 * Logic:
 *  1) Compose a message to notify the user about the missed maturity.
 *  2) Log the notification activity.
 */
async function notifyCustomer(req, res) {
    const { duedate, amount, remaining, itemid, itemname, userid } = req.body;

    try {
        // Use the userid to get the email from the database
        const userQuery = {
            text: `SELECT email FROM skyeu."users" WHERE id = $1`,
            values: [userid]
        };
        const { rows: [userRows] } = await pg.query(userQuery);

        if (userRows.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: `No user found with id: ${userid}`,
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        const userEmail = userRows.email;
        // 1) Compose the notification message
        const message = `Dear User, the maturity date for your property item "${itemname}" (Item ID: ${itemid}) has passed as of ${duedate}. The total amount due was ${amount}, and the remaining balance is ${remaining}. If you make the payment today, you can withdraw the item, and it will be yours. This will also increase your percentage delivery score.`;

        await sendEmail({
            to: userEmail,
            subject: 'Missed Maturity Notification',
            text: message,
            html: `<p>${message}</p>`  
        });
 

        // 2) Log the notification activity
        await activityMiddleware(
            req,
            userid,
            `Notification sent to user about missed maturity for item "${itemname}" (Item ID: ${itemid})`,
            "NOTIFY_CUSTOMER"
        );

        // 3) Return success response
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Notification sent successfully",
            statuscode: StatusCodes.OK,
            data: { notificationMessage: message },
            errors: []
        });
    } catch (error) {
        console.error("Unexpected Error:", error);
        await activityMiddleware(
            req,
            userid || null,
            "An unexpected error occurred while notifying customer",
            "NOTIFY_CUSTOMER"
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
}

module.exports = {
    notifyCustomer
};

