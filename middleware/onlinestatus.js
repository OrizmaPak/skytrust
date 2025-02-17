const { StatusCodes } = require("http-status-codes");
const pg = require("../db/pg");
const { activityMiddleware } = require("./activity");

const manageOnlineUser = async (req, res, next) => {
    
    const userid = req.user.id

    try {
        const queryString = `
            SELECT *
            FROM sky."Lastseen"
            WHERE userid = $1
        `;

        const { rows: existingUser } = await pg.query(queryString, [userid]);

        if (existingUser.length > 0) {
            const updateQueryString = `
                UPDATE sky."Lastseen"
                SET date = NOW()
                WHERE userid = $1
            `;

            await pg.query(updateQueryString, [userid]);
        } else {
            const insertQueryString = `
                INSERT INTO sky."Lastseen" (userid, date)
                VALUES ($1, NOW())
            `;

            await pg.query(insertQueryString, [userid]);
        }

       next()
    } catch (err) {
        next()
    }
}

module.exports = {
    manageOnlineUser
};

