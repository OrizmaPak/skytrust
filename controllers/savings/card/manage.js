const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');
const pg = require('../../../db/pg');
const { activityMiddleware } = require('../../../middleware/activity');

const CARD_BRANDS = ['VISA', 'MASTERCARD', 'VERVE'];
const CARD_TYPES = ['DEBIT', 'CREDIT', 'PREPAID'];
const CARD_STATUSES = ['ACTIVE', 'BLOCKED', 'EXPIRED', 'INACTIVE'];

const normalizeCardNumber = (value) => String(value || '').replace(/\D/g, '');

const secureCardNumber = (cardnumber) => {
    const secret = process.env.CARD_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret) throw new Error('CARD_ENCRYPTION_KEY is not configured.');

    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(cardnumber, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        encrypted: `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`,
        hash: crypto.createHash('sha256').update(cardnumber).digest('hex'),
        lastfour: cardnumber.slice(-4)
    };
};

const requireCardAdministrator = (req, res) => {
    const role = String(req.user?.role || '').toUpperCase();
    if (role && !['MEMBER', 'USER'].includes(role)) return true;

    res.status(StatusCodes.FORBIDDEN).json({
        status: false,
        message: 'Administrator access is required',
        statuscode: StatusCodes.FORBIDDEN,
        data: null,
        errors: ['Only authorized staff can manage complete card details.']
    });
    return false;
};

const getCards = async (req, res) => {
    if (!requireCardAdministrator(req, res)) return;
    const { accountnumber, id } = req.query;

    try {
        const filters = [];
        const values = [];

        if (accountnumber) {
            values.push(String(accountnumber));
            filters.push(`s.accountnumber::text = $${values.length}`);
        }
        if (id) {
            values.push(Number(id));
            filters.push(`c.id = $${values.length}`);
        }

        const { rows } = await pg.query(`
            SELECT c.id, c.savingsaccountid, c.cardholder, c.cardtype, c.cardbrand,
                   c.expirymonth, c.expiryyear, c.spendinglimit, c.status,
                   c.cardlastfour,
                   CONCAT('**** **** **** ', c.cardlastfour) AS cardnumber,
                   s.accountnumber::text AS accountnumber,
                   sp.productname, sp.currency,
                   CONCAT_WS(' ', u.firstname, u.lastname, u.othernames) AS accountholder
            FROM skytobi."Card" c
            JOIN skytobi."savings" s ON s.id = c.savingsaccountid
            JOIN skytobi."User" u ON u.id = s.userid
            LEFT JOIN skytobi."savingsproduct" sp ON sp.id = s.savingsproductid
            ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
            ORDER BY c.id DESC
        `, values);

        return res.status(StatusCodes.OK).json({
            status: true,
            message: 'Card details fetched successfully',
            statuscode: StatusCodes.OK,
            data: rows,
            errors: []
        });
    } catch (error) {
        console.error('Error fetching card details:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Unable to fetch card details',
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

const manageCard = async (req, res) => {
    if (!requireCardAdministrator(req, res)) return;
    const user = req.user;
    const {
        accountnumber,
        cardholder,
        cardtype = 'DEBIT',
        cardbrand = 'VISA',
        expirymonth,
        expiryyear,
        spendinglimit,
        status = 'ACTIVE'
    } = req.body;
    const cardnumber = normalizeCardNumber(req.body.cardnumber);
    const normalizedBrand = String(cardbrand).toUpperCase();
    const normalizedType = String(cardtype).toUpperCase();
    const normalizedStatus = String(status).toUpperCase();
    const expiryMonth = Number(expirymonth);
    const expiryYear = Number(expiryyear);
    const limit = spendinglimit === '' || spendinglimit === undefined || spendinglimit === null
        ? null
        : Number(spendinglimit);

    const errors = [];
    if (!accountnumber) errors.push('Account number is required.');
    if (!cardholder || !String(cardholder).trim()) errors.push('Card holder is required.');
    if (cardnumber && !/^\d{12,19}$/.test(cardnumber)) errors.push('Card number must contain 12 to 19 digits.');
    if (!CARD_BRANDS.includes(normalizedBrand)) errors.push('Unsupported card brand.');
    if (!CARD_TYPES.includes(normalizedType)) errors.push('Unsupported card type.');
    if (!CARD_STATUSES.includes(normalizedStatus)) errors.push('Unsupported card status.');
    if (!Number.isInteger(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) errors.push('Expiry month must be between 1 and 12.');
    if (!Number.isInteger(expiryYear) || expiryYear < 2000 || expiryYear > 2200) errors.push('Expiry year must use four digits.');
    if (limit !== null && (!Number.isFinite(limit) || limit < 0)) errors.push('Spending limit must be zero or greater.');

    if (errors.length) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: 'Invalid card details',
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors
        });
    }

    try {
        const { rows: [account] } = await pg.query(`
            SELECT s.id, s.accountnumber::text AS accountnumber
            FROM skytobi."savings" s
            WHERE s.accountnumber::text = $1 AND s.status != 'DELETED'
        `, [String(accountnumber)]);

        if (!account) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Savings account not found',
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ['Provision cards only for an existing savings account.']
            });
        }

        const { rows: [existingCard] } = await pg.query(`
            SELECT cardnumberencrypted, cardnumberhash, cardlastfour
            FROM skytobi."Card"
            WHERE savingsaccountid = $1
        `, [account.id]);

        if (!cardnumber && !existingCard) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Card number is required for a new card',
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: ['Card number must contain 12 to 19 digits.']
            });
        }

        const securedNumber = cardnumber ? secureCardNumber(cardnumber) : {
            encrypted: existingCard.cardnumberencrypted,
            hash: existingCard.cardnumberhash,
            lastfour: existingCard.cardlastfour
        };

        const { rows: [card] } = await pg.query(`
            INSERT INTO skytobi."Card"
                (savingsaccountid, cardnumberencrypted, cardnumberhash, cardlastfour,
                 cardholder, cardtype, cardbrand, expirymonth, expiryyear,
                 spendinglimit, status, createdby)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (savingsaccountid) DO UPDATE SET
                cardnumberencrypted = EXCLUDED.cardnumberencrypted,
                cardnumberhash = EXCLUDED.cardnumberhash,
                cardlastfour = EXCLUDED.cardlastfour,
                cardholder = EXCLUDED.cardholder,
                cardtype = EXCLUDED.cardtype,
                cardbrand = EXCLUDED.cardbrand,
                expirymonth = EXCLUDED.expirymonth,
                expiryyear = EXCLUDED.expiryyear,
                spendinglimit = EXCLUDED.spendinglimit,
                status = EXCLUDED.status,
                lastupdated = NOW()
            RETURNING id, savingsaccountid, cardholder, cardtype, cardbrand,
                      expirymonth, expiryyear, spendinglimit, status, cardlastfour
        `, [
            account.id,
            securedNumber.encrypted,
            securedNumber.hash,
            securedNumber.lastfour,
            String(cardholder).trim(),
            normalizedType,
            normalizedBrand,
            expiryMonth,
            expiryYear,
            limit,
            normalizedStatus,
            user.id
        ]);

        await activityMiddleware(req, user.id, `Card provisioned for account ${account.accountnumber}`, 'ACCOUNT');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: 'Card details saved successfully',
            statuscode: StatusCodes.OK,
            data: card,
            errors: []
        });
    } catch (error) {
        console.error('Error saving card details:', error);
        const duplicate = error.code === '23505';
        return res.status(duplicate ? StatusCodes.CONFLICT : StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: duplicate ? 'That card number is already provisioned' : 'Unable to save card details',
            statuscode: duplicate ? StatusCodes.CONFLICT : StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

const deleteCard = async (req, res) => {
    if (!requireCardAdministrator(req, res)) return;
    try {
        const { rows: [card] } = await pg.query(
            `DELETE FROM skytobi."Card" WHERE id = $1 RETURNING id, savingsaccountid`,
            [Number(req.params.id)]
        );

        if (!card) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: 'Card not found',
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: []
            });
        }

        await activityMiddleware(req, req.user.id, 'Card details removed', 'ACCOUNT');
        return res.status(StatusCodes.OK).json({
            status: true,
            message: 'Card details removed successfully',
            statuscode: StatusCodes.OK,
            data: card,
            errors: []
        });
    } catch (error) {
        console.error('Error deleting card details:', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Unable to remove card details',
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = { getCards, manageCard, deleteCard };
