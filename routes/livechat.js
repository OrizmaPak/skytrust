const crypto = require('crypto');
const express = require('express');
const cloudinary = require('cloudinary').v2;
const { StatusCodes } = require('http-status-codes');
const pg = require('../db/pg');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

let schemaReady;

const ok = (res, message, data = null, statuscode = StatusCodes.OK) => res.status(statuscode).json({
  status: true,
  message,
  statuscode,
  data,
  errors: []
});

const fail = (res, statuscode, message, errors = []) => res.status(statuscode).json({
  status: false,
  message,
  statuscode,
  data: null,
  errors
});

const getAuthToken = req => req.headers.authorization?.split(' ')[1] || '';

const ensureSchema = () => {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pg.query(`
        CREATE TABLE IF NOT EXISTS sky.livechat_conversation (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'OPEN',
          visitortype TEXT NOT NULL DEFAULT 'GUEST',
          visitorsessionid TEXT,
          userid INTEGER,
          accountnumber TEXT,
          displayname TEXT,
          email TEXT,
          phone TEXT,
          sourcepage TEXT,
          assignedto INTEGER,
          lastmessageat TIMESTAMPTZ DEFAULT NOW(),
          createdat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updatedat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          closedat TIMESTAMPTZ,
          closedby INTEGER
        )
      `);
      await pg.query(`
        CREATE TABLE IF NOT EXISTS sky.livechat_message (
          id TEXT PRIMARY KEY,
          conversationid TEXT NOT NULL REFERENCES sky.livechat_conversation(id) ON DELETE CASCADE,
          sendertype TEXT NOT NULL,
          senderid INTEGER,
          body TEXT,
          attachmenturl TEXT,
          attachmentname TEXT,
          attachmenttype TEXT,
          createdat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          readat TIMESTAMPTZ
        )
      `);
      await pg.query('CREATE INDEX IF NOT EXISTS livechat_conversation_status_idx ON sky.livechat_conversation(status)');
      await pg.query('CREATE INDEX IF NOT EXISTS livechat_conversation_user_idx ON sky.livechat_conversation(userid)');
      await pg.query('CREATE INDEX IF NOT EXISTS livechat_conversation_visitor_idx ON sky.livechat_conversation(visitorsessionid)');
      await pg.query('CREATE INDEX IF NOT EXISTS livechat_message_conversation_idx ON sky.livechat_message(conversationid, createdat)');
    })();
  }
  return schemaReady;
};

const hydrateUser = async req => {
  if (req.livechatUser !== undefined) return req.livechatUser;
  req.livechatUser = null;
  const token = getAuthToken(req);
  if (!token) return null;

  const { rows: [session] } = await pg.query(
    'SELECT * FROM sky."Session" WHERE sessiontoken = $1',
    [token]
  );
  if (!session || session.expires <= new Date()) return null;

  const { rows: [user] } = await pg.query(
    'SELECT id, firstname, lastname, email, phone, role, permissions, branch, registrationpoint, status FROM sky."User" WHERE id = $1',
    [session.userid]
  );
  if (!user || user.status !== 'ACTIVE') return null;
  req.livechatUser = user;
  return user;
};

const isAdminUser = user => {
  const role = String(user?.role || '').toUpperCase();
  return Boolean(user && role && role !== 'MEMBER' && role !== 'USER');
};

const requireAdmin = async (req, res, next) => {
  const user = await hydrateUser(req);
  if (!isAdminUser(user)) {
    return fail(res, StatusCodes.UNAUTHORIZED, 'Admin access required');
  }
  req.user = user;
  return next();
};

const mapConversation = row => row ? ({
  id: row.id,
  status: row.status,
  visitorType: row.visitortype,
  visitorSessionId: row.visitorsessionid,
  userid: row.userid,
  accountnumber: row.accountnumber,
  displayName: row.displayname,
  email: row.email,
  phone: row.phone,
  sourcePage: row.sourcepage,
  assignedTo: row.assignedto,
  lastMessageAt: row.lastmessageat,
  createdAt: row.createdat,
  updatedAt: row.updatedat,
  closedAt: row.closedat,
  closedBy: row.closedby,
  latestMessage: row.latestbody || null,
  unreadCount: Number(row.unreadcount || 0)
}) : null;

const mapMessage = row => row ? ({
  id: row.id,
  conversationId: row.conversationid,
  senderType: row.sendertype,
  senderId: row.senderid,
  body: row.body,
  attachmentUrl: row.attachmenturl,
  attachmentName: row.attachmentname,
  attachmentType: row.attachmenttype,
  createdAt: row.createdat,
  readAt: row.readat
}) : null;

const getGuestSessionId = req => req.body.visitorSessionId || req.query.visitorSessionId || req.headers['x-livechat-visitor-session'] || '';

const canReadConversation = async (req, conversation) => {
  const user = await hydrateUser(req);
  if (isAdminUser(user)) return true;
  if (user && conversation.userid && Number(conversation.userid) === Number(user.id)) return true;
  const visitorSessionId = getGuestSessionId(req);
  return Boolean(conversation.visitorsessionid && visitorSessionId && conversation.visitorsessionid === visitorSessionId);
};

const uploadAttachment = async req => {
  const file = req.files?.[0];
  if (!file) return {};

  const allowed = /^(image\/|application\/pdf$|text\/plain$)/i;
  if (!allowed.test(file.mimetype || '')) {
    const error = new Error('Unsupported attachment type');
    error.statuscode = StatusCodes.BAD_REQUEST;
    throw error;
  }
  if (file.size > 8 * 1024 * 1024) {
    const error = new Error('Attachment is too large');
    error.statuscode = StatusCodes.BAD_REQUEST;
    throw error;
  }

  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({
      resource_type: 'auto',
      folder: 'skytrust/livechat',
      public_id: `${Date.now()}-${crypto.randomUUID()}`
    }, (error, uploadResult) => {
      if (error) reject(error);
      else resolve(uploadResult);
    }).end(file.buffer);
  });

  return {
    attachmentUrl: result.secure_url,
    attachmentName: file.originalname,
    attachmentType: file.mimetype
  };
};

const findConversationById = async id => {
  const { rows: [conversation] } = await pg.query(
    'SELECT * FROM sky.livechat_conversation WHERE id = $1',
    [id]
  );
  return conversation;
};

router.use(async (req, res, next) => {
  try {
    await ensureSchema();
    await hydrateUser(req);
    next();
  } catch (error) {
    console.error('Live chat setup failed:', error);
    fail(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Live chat is not available');
  }
});

router.route('/conversations')
  .post(async (req, res) => {
    const user = req.livechatUser;
    const visitorType = user ? 'CLIENT' : 'GUEST';
    const visitorSessionId = user ? null : getGuestSessionId(req);

    if (!user && !visitorSessionId) {
      return fail(res, StatusCodes.BAD_REQUEST, 'visitorSessionId is required for guest chat');
    }

    const activeQuery = user
      ? ['SELECT * FROM sky.livechat_conversation WHERE userid = $1 AND status = $2 ORDER BY lastmessageat DESC LIMIT 1', [user.id, 'OPEN']]
      : ['SELECT * FROM sky.livechat_conversation WHERE visitorsessionid = $1 AND status = $2 ORDER BY lastmessageat DESC LIMIT 1', [visitorSessionId, 'OPEN']];
    const { rows: [active] } = await pg.query(activeQuery[0], activeQuery[1]);
    if (active) return ok(res, 'Conversation loaded', { conversation: mapConversation(active) });

    const id = crypto.randomUUID();
    const displayName = user ? `${user.firstname || ''} ${user.lastname || ''}`.trim() : (req.body.displayName || '');
    const email = user?.email || req.body.email || '';
    const phone = user?.phone || req.body.phone || '';
    const accountnumber = req.body.accountnumber ? String(req.body.accountnumber) : null;
    const sourcePage = req.body.sourcePage || '';

    const { rows: [conversation] } = await pg.query(`
      INSERT INTO sky.livechat_conversation
        (id, visitortype, visitorsessionid, userid, accountnumber, displayname, email, phone, sourcepage)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [id, visitorType, visitorSessionId, user?.id || null, accountnumber, displayName, email, phone, sourcePage]);

    return ok(res, 'Conversation created', { conversation: mapConversation(conversation) }, StatusCodes.CREATED);
  })
  .get(requireAdmin, async (req, res) => {
    const status = String(req.query.status || '').toUpperCase();
    const q = String(req.query.q || '').trim();
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
    const offset = (page - 1) * limit;
    const filters = [];
    const values = [];

    if (status === 'OPEN' || status === 'CLOSED') {
      values.push(status);
      filters.push(`c.status = $${values.length}`);
    }
    if (q) {
      values.push(`%${q}%`);
      filters.push(`(
        c.displayname ILIKE $${values.length}
        OR c.email ILIKE $${values.length}
        OR c.phone ILIKE $${values.length}
        OR c.accountnumber ILIKE $${values.length}
        OR c.sourcepage ILIKE $${values.length}
        OR latest.body ILIKE $${values.length}
      )`);
    }

    values.push(limit, offset);
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const { rows } = await pg.query(`
      SELECT c.*, latest.body AS latestbody,
        COUNT(m.id) FILTER (WHERE m.readat IS NULL AND m.sendertype <> 'ADMIN') AS unreadcount
      FROM sky.livechat_conversation c
      LEFT JOIN LATERAL (
        SELECT body FROM sky.livechat_message
        WHERE conversationid = c.id
        ORDER BY createdat DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN sky.livechat_message m ON m.conversationid = c.id
      ${where}
      GROUP BY c.id, latest.body
      ORDER BY c.lastmessageat DESC NULLS LAST, c.createdat DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `, values);

    return ok(res, 'Conversations fetched', {
      conversations: rows.map(mapConversation),
      page,
      limit
    });
  });

router.route('/conversations/:id')
  .get(async (req, res) => {
    const conversation = await findConversationById(req.params.id);
    if (!conversation) return fail(res, StatusCodes.NOT_FOUND, 'Conversation not found');
    if (!await canReadConversation(req, conversation)) return fail(res, StatusCodes.UNAUTHORIZED, 'Unauthorized live chat access');

    if (isAdminUser(req.livechatUser)) {
      await pg.query(
        "UPDATE sky.livechat_message SET readat = COALESCE(readat, NOW()) WHERE conversationid = $1 AND sendertype <> 'ADMIN'",
        [conversation.id]
      );
    }

    const { rows: messages } = await pg.query(
      'SELECT * FROM sky.livechat_message WHERE conversationid = $1 ORDER BY createdat ASC',
      [conversation.id]
    );
    return ok(res, 'Conversation fetched', {
      conversation: mapConversation(conversation),
      messages: messages.map(mapMessage)
    });
  })
  .patch(requireAdmin, async (req, res) => {
    const { assignedTo } = req.body;
    const { rows: [conversation] } = await pg.query(`
      UPDATE sky.livechat_conversation
      SET assignedto = COALESCE($1, assignedto), updatedat = NOW()
      WHERE id = $2
      RETURNING *
    `, [assignedTo || null, req.params.id]);
    if (!conversation) return fail(res, StatusCodes.NOT_FOUND, 'Conversation not found');
    return ok(res, 'Conversation updated', { conversation: mapConversation(conversation) });
  });

router.route('/conversations/:id/messages')
  .get(async (req, res) => {
    const conversation = await findConversationById(req.params.id);
    if (!conversation) return fail(res, StatusCodes.NOT_FOUND, 'Conversation not found');
    if (!await canReadConversation(req, conversation)) return fail(res, StatusCodes.UNAUTHORIZED, 'Unauthorized live chat access');

    const after = req.query.after;
    const values = [conversation.id];
    let afterClause = '';
    if (after && !Number.isNaN(new Date(after).getTime())) {
      values.push(after);
      afterClause = 'AND createdat > $2::timestamptz';
    }
    const { rows } = await pg.query(`
      SELECT * FROM sky.livechat_message
      WHERE conversationid = $1 ${afterClause}
      ORDER BY createdat ASC
    `, values);
    return ok(res, 'Messages fetched', { messages: rows.map(mapMessage) });
  })
  .post(async (req, res) => {
    const conversation = await findConversationById(req.params.id);
    if (!conversation) return fail(res, StatusCodes.NOT_FOUND, 'Conversation not found');
    if (conversation.status === 'CLOSED') return fail(res, StatusCodes.BAD_REQUEST, 'Conversation is closed');

    const user = req.livechatUser;
    const senderType = String(req.body.senderType || (user ? 'CLIENT' : 'GUEST')).toUpperCase();
    const adminSending = senderType === 'ADMIN';

    if (adminSending && !isAdminUser(user)) return fail(res, StatusCodes.UNAUTHORIZED, 'Admin access required');
    if (!adminSending && !await canReadConversation(req, conversation)) return fail(res, StatusCodes.UNAUTHORIZED, 'Unauthorized live chat access');

    const body = String(req.body.body || '').trim();
    let attachment = {};
    try {
      attachment = await uploadAttachment(req);
    } catch (error) {
      return fail(res, error.statuscode || StatusCodes.INTERNAL_SERVER_ERROR, error.message || 'Attachment upload failed');
    }

    if (!body && !attachment.attachmentUrl) {
      return fail(res, StatusCodes.BAD_REQUEST, 'Message or attachment is required');
    }

    const id = crypto.randomUUID();
    const { rows: [message] } = await pg.query(`
      INSERT INTO sky.livechat_message
        (id, conversationid, sendertype, senderid, body, attachmenturl, attachmentname, attachmenttype)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      id,
      conversation.id,
      senderType === 'CLIENT' && !user ? 'GUEST' : senderType,
      user?.id || null,
      body,
      attachment.attachmentUrl || null,
      attachment.attachmentName || null,
      attachment.attachmentType || null
    ]);

    const { rows: [updatedConversation] } = await pg.query(`
      UPDATE sky.livechat_conversation
      SET lastmessageat = NOW(), updatedat = NOW()
      WHERE id = $1
      RETURNING *
    `, [conversation.id]);

    return ok(res, 'Message sent', {
      conversation: mapConversation(updatedConversation),
      message: mapMessage(message),
      messages: [mapMessage(message)]
    }, StatusCodes.CREATED);
  });

router.post('/conversations/:id/close', requireAdmin, async (req, res) => {
  const { rows: [conversation] } = await pg.query(`
    UPDATE sky.livechat_conversation
    SET status = 'CLOSED', closedat = NOW(), closedby = $1, updatedat = NOW()
    WHERE id = $2
    RETURNING *
  `, [req.user.id, req.params.id]);
  if (!conversation) return fail(res, StatusCodes.NOT_FOUND, 'Conversation not found');

  return ok(res, 'Conversation closed', { conversation: mapConversation(conversation) });
});

module.exports = router;
