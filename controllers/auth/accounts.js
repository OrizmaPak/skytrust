const { StatusCodes } = require('http-status-codes');
const pg = require('../../db/pg');
const { getaccountTransactions } = require('../transactions/getanaccount');
const { getBalance } = require('../transactions/getbalance');

const findOwnedAccount = async (userId, accountnumber) => {
    const { rows: [account] } = await pg.query(`
        SELECT s.id, s.accountnumber::text AS accountnumber, s.routingnumber,
               s.status, s.savingsproductid, sp.productname, sp.currency
        FROM skytobi."savings" s
        LEFT JOIN skytobi."savingsproduct" sp ON sp.id = s.savingsproductid
        WHERE s.userid = $1 AND s.accountnumber::text = $2 AND s.status != 'DELETED'
    `, [userId, String(accountnumber)]);
    return account;
};

const accountNotFound = (res) => res.status(StatusCodes.NOT_FOUND).json({
    status: false,
    message: 'Account not found',
    statuscode: StatusCodes.NOT_FOUND,
    data: null,
    errors: ['The account does not belong to the signed-in customer.']
});

const getPortalAccounts = async (req, res) => {
    try {
        const { rows } = await pg.query(`
            SELECT s.id, s.accountnumber::text AS accountnumber, s.routingnumber,
                   s.status, s.savingsproductid, sp.productname, sp.currency,
                   COALESCE((
                       SELECT SUM(t.credit) - SUM(t.debit)
                       FROM skytobi."transaction" t
                       WHERE t.accountnumber = s.accountnumber::text AND t.status = 'ACTIVE'
                   ), 0) AS balance,
                   EXISTS(
                       SELECT 1 FROM skytobi."Card" c WHERE c.savingsaccountid = s.id
                   ) AS hascard
            FROM skytobi."savings" s
            LEFT JOIN skytobi."savingsproduct" sp ON sp.id = s.savingsproductid
            WHERE s.userid = $1 AND s.status != 'DELETED'
            ORDER BY CASE WHEN s.status = 'ACTIVE' THEN 0 ELSE 1 END, s.id ASC
        `, [req.user.id]);

        return res.status(StatusCodes.OK).json({
            status: true,
            message: 'Customer accounts fetched successfully',
            statuscode: StatusCodes.OK,
            data: rows,
            errors: []
        });
    } catch (error) {
        console.error('Error fetching customer accounts:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Unable to fetch customer accounts',
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

const getPortalCard = async (req, res) => {
    try {
        const account = await findOwnedAccount(req.user.id, req.params.accountnumber);
        if (!account) return accountNotFound(res);

        const { rows: [card] } = await pg.query(`
            SELECT c.cardholder, c.cardtype, c.cardbrand, c.expirymonth,
                   c.expiryyear, c.spendinglimit, c.status,
                   c.cardlastfour AS lastfour
            FROM skytobi."Card" c
            WHERE c.savingsaccountid = $1
        `, [account.id]);

        const data = card ? {
            ...card,
            cardnumber: `**** **** **** ${card.lastfour}`,
            accountnumber: account.accountnumber,
            productname: account.productname,
            currency: account.currency
        } : null;

        return res.status(StatusCodes.OK).json({
            status: true,
            message: card ? 'Card details fetched successfully' : 'No card has been provisioned for this account',
            statuscode: StatusCodes.OK,
            data,
            errors: []
        });
    } catch (error) {
        console.error('Error fetching customer card:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Unable to fetch card details',
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

const getPortalTransactions = async (req, res) => {
    try {
        const account = await findOwnedAccount(req.user.id, req.params.accountnumber);
        if (!account) return accountNotFound(res);
        const allowedQuery = ['startdate', 'enddate', 'q', 'order', 'page', 'limit'];
        req.query = allowedQuery.reduce((query, key) => {
            if (req.query[key] !== undefined) query[key] = req.query[key];
            return query;
        }, { accountnumber: account.accountnumber });
        return getaccountTransactions(req, res);
    } catch (error) {
        console.error('Error validating customer transaction account:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Unable to fetch account transactions',
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

const getPortalBalance = async (req, res) => {
    try {
        const account = await findOwnedAccount(req.user.id, req.params.accountnumber);
        if (!account) return accountNotFound(res);
        req.query = { accountnumber: account.accountnumber };
        return getBalance(req, res);
    } catch (error) {
        console.error('Error validating customer balance account:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Unable to fetch account balance',
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = {
    getPortalAccounts,
    getPortalCard,
    getPortalTransactions,
    getPortalBalance
};
