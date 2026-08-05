require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { databaseUrl: targetDatabaseUrl, expectedDatabaseSchema } = require('../config/env');

const apply = process.argv.includes('--apply');
const sourceDatabaseUrl = process.env.SOURCE_DATABASE_URL?.trim();

if (!sourceDatabaseUrl) {
  throw new Error('SOURCE_DATABASE_URL is required for the database merge');
}

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const normalizeValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  return value;
};

function connectionIdentity(connectionString) {
  const url = new URL(connectionString);

  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, ''),
    schema: url.searchParams.get('schema') || 'public',
  };
}

async function connectWithRetry(connectionString, label) {
  let lastError;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });

    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});

      if (attempt < 8) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 1500, 5000)));
      }
    }
  }

  throw new Error(`Unable to connect to ${label} database: ${lastError.message}`);
}

async function tableExists(client, schema, table) {
  const result = await client.query(
    `SELECT 1
       FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'`,
    [schema, table],
  );

  return result.rowCount > 0;
}

async function columnsFor(client, schema, table) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position`,
    [schema, table],
  );

  return result.rows.map((row) => row.column_name);
}

async function rowsFrom(client, schema, table) {
  if (!(await tableExists(client, schema, table))) return [];
  return (await client.query(`SELECT * FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`)).rows;
}

async function insertRow(client, schema, table, row, columns, returning = 'id') {
  const insertColumns = columns.filter((column) => column !== 'id' && Object.hasOwn(row, column));
  const values = insertColumns.map((column) => row[column]);
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const returningClause = returning ? ` RETURNING ${quoteIdentifier(returning)}` : '';
  const sql = `INSERT INTO ${quoteIdentifier(schema)}.${quoteIdentifier(table)}
    (${insertColumns.map(quoteIdentifier).join(', ')})
    VALUES (${placeholders.join(', ')})${returningClause}`;
  const result = await client.query(sql, values);
  return returning ? result.rows[0][returning] : null;
}

async function insertRows(client, schema, table, rows, columns) {
  if (!rows.length) return;

  const insertColumns = columns.filter(
    (column) => column !== 'id' && rows.every((row) => Object.hasOwn(row, column)),
  );
  const chunkSize = Math.max(1, Math.floor(60000 / insertColumns.length));

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values = [];
    const groups = chunk.map((row) => {
      const placeholders = insertColumns.map((column) => {
        values.push(row[column]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const sql = `INSERT INTO ${quoteIdentifier(schema)}.${quoteIdentifier(table)}
      (${insertColumns.map(quoteIdentifier).join(', ')})
      VALUES ${groups.join(', ')}`;
    await client.query(sql, values);
  }
}

function fingerprint(row, columns) {
  return JSON.stringify(columns.map((column) => normalizeValue(row[column])));
}

async function main() {
  const sourceIdentity = connectionIdentity(sourceDatabaseUrl);
  const targetIdentity = connectionIdentity(targetDatabaseUrl);

  if (
    sourceIdentity.host === targetIdentity.host
    && sourceIdentity.database === targetIdentity.database
    && sourceIdentity.schema === targetIdentity.schema
  ) {
    throw new Error('Source and target resolve to the same database schema');
  }

  if (expectedDatabaseSchema && targetIdentity.schema !== expectedDatabaseSchema) {
    throw new Error(`Target schema must be ${expectedDatabaseSchema}, received ${targetIdentity.schema}`);
  }

  const source = await connectWithRetry(sourceDatabaseUrl, 'source');
  const target = await connectWithRetry(targetDatabaseUrl, 'target');
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    source: sourceIdentity,
    target: targetIdentity,
    inserted: {},
    existing: {},
    conflicts: [],
  };

  const count = (bucket, table) => {
    report[bucket][table] = (report[bucket][table] || 0) + 1;
  };

  try {
    await target.query('BEGIN');

    const sourceUsers = await rowsFrom(source, sourceIdentity.schema, 'User');
    const targetUsers = await rowsFrom(target, targetIdentity.schema, 'User');
    const userColumns = await columnsFor(target, targetIdentity.schema, 'User');
    const userMap = new Map();

    for (const sourceUser of sourceUsers) {
      const email = normalizeText(sourceUser.email);
      const existing = targetUsers.find((user) => normalizeText(user.email) === email);

      if (existing) {
        userMap.set(sourceUser.id, existing.id);
        count('existing', 'User');

        const changedFields = ['firstname', 'lastname', 'phone', 'role', 'status']
          .filter((field) => normalizeText(sourceUser[field]) !== normalizeText(existing[field]));
        if (sourceUser.password !== existing.password) changedFields.push('password');

        if (changedFields.length) {
          report.conflicts.push({
            table: 'User',
            key: sourceUser.email,
            action: 'kept-target-login',
            changedFields,
          });
        }
        continue;
      }

      const phoneOwner = targetUsers.find(
        (user) => normalizeText(user.phone) === normalizeText(sourceUser.phone),
      );
      if (phoneOwner) {
        throw new Error(
          `Cannot migrate ${sourceUser.email}: phone number belongs to another target user`,
        );
      }

      const targetUserId = await insertRow(
        target,
        targetIdentity.schema,
        'User',
        { ...sourceUser, createdby: 0 },
        userColumns,
      );
      userMap.set(sourceUser.id, targetUserId);
      targetUsers.push({ ...sourceUser, id: targetUserId });
      count('inserted', 'User');
    }

    const mapUserId = (value) => {
      if (value === null || value === undefined) return value;
      if (Number(value) === 0) return 0;
      return userMap.get(Number(value)) || 0;
    };

    async function mapReferenceTable(table, sourceKey, targetKey = sourceKey) {
      const sourceRows = await rowsFrom(source, sourceIdentity.schema, table);
      const targetRows = await rowsFrom(target, targetIdentity.schema, table);
      const targetColumns = await columnsFor(target, targetIdentity.schema, table);
      const idMap = new Map();

      for (const sourceRow of sourceRows) {
        const existing = targetRows.find(
          (targetRow) => normalizeText(targetRow[targetKey]) === normalizeText(sourceRow[sourceKey]),
        );

        if (existing) {
          idMap.set(sourceRow.id, existing.id);
          count('existing', table);
          continue;
        }

        const id = await insertRow(
          target,
          targetIdentity.schema,
          table,
          { ...sourceRow, createdby: mapUserId(sourceRow.createdby) },
          targetColumns,
        );
        idMap.set(sourceRow.id, id);
        targetRows.push({ ...sourceRow, id });
        count('inserted', table);
      }

      return idMap;
    }

    const memberMap = await mapReferenceTable('DefineMember', 'member');
    const productMap = await mapReferenceTable('savingsproduct', 'productname');

    const sourceBanks = await rowsFrom(source, sourceIdentity.schema, 'listofbanks');
    const targetBanks = await rowsFrom(target, targetIdentity.schema, 'listofbanks');
    const bankColumns = await columnsFor(target, targetIdentity.schema, 'listofbanks');
    const bankMap = new Map();

    for (const sourceBank of sourceBanks) {
      let existing = targetBanks.find(
        (bank) => normalizeText(bank.bank) === normalizeText(sourceBank.bank)
          && normalizeText(bank.country) === normalizeText(sourceBank.country),
      );

      if (!existing) {
        const id = await insertRow(
          target,
          targetIdentity.schema,
          'listofbanks',
          { ...sourceBank, createdby: mapUserId(sourceBank.createdby) },
          bankColumns,
        );
        existing = { ...sourceBank, id };
        targetBanks.push(existing);
        count('inserted', 'listofbanks');
      } else {
        count('existing', 'listofbanks');
      }
      bankMap.set(sourceBank.id, existing.id);
    }

    async function mergeByKey(table, keyFor, transform = (row) => row, filter = () => true) {
      const sourceRows = (await rowsFrom(source, sourceIdentity.schema, table)).filter(filter);
      const targetRows = await rowsFrom(target, targetIdentity.schema, table);
      const targetColumns = await columnsFor(target, targetIdentity.schema, table);
      const resultMap = new Map();

      for (const sourceRow of sourceRows) {
        const row = transform({ ...sourceRow });
        const key = keyFor(row);
        const existing = targetRows.find((targetRow) => keyFor(targetRow) === key);

        if (existing) {
          resultMap.set(sourceRow.id, existing.id);
          count('existing', table);
          continue;
        }

        const id = await insertRow(target, targetIdentity.schema, table, row, targetColumns);
        targetRows.push({ ...row, id });
        resultMap.set(sourceRow.id, id);
        count('inserted', table);
      }

      return resultMap;
    }

    await mergeByKey(
      'Membership',
      (row) => `${row.member}:${row.userid}:${row.status}`,
      (row) => ({
        ...row,
        member: memberMap.get(row.member),
        userid: mapUserId(row.userid),
        createdby: mapUserId(row.createdby),
      }),
      (row) => userMap.has(row.userid) && memberMap.has(row.member),
    );

    const savingsMap = await mergeByKey(
      'savings',
      (row) => String(row.accountnumber),
      (row) => ({
        ...row,
        userid: mapUserId(row.userid),
        createdby: mapUserId(row.createdby),
        savingsproductid: productMap.get(row.savingsproductid),
      }),
      (row) => userMap.has(row.userid) && productMap.has(row.savingsproductid),
    );

    async function mergeExact(table, transform = (row) => row, filter = () => true) {
      if (!(await tableExists(source, sourceIdentity.schema, table))) return;

      const sourceColumns = await columnsFor(source, sourceIdentity.schema, table);
      const targetColumns = await columnsFor(target, targetIdentity.schema, table);
      const comparableColumns = targetColumns.filter(
        (column) => column !== 'id' && sourceColumns.includes(column),
      );
      const targetRows = await rowsFrom(target, targetIdentity.schema, table);
      const targetCounts = new Map();
      const pendingRows = [];

      for (const targetRow of targetRows) {
        const key = fingerprint(targetRow, comparableColumns);
        targetCounts.set(key, (targetCounts.get(key) || 0) + 1);
      }

      for (const sourceRow of (await rowsFrom(source, sourceIdentity.schema, table)).filter(filter)) {
        const row = transform({ ...sourceRow });
        const key = fingerprint(row, comparableColumns);
        const remaining = targetCounts.get(key) || 0;

        if (remaining > 0) {
          targetCounts.set(key, remaining - 1);
          count('existing', table);
          continue;
        }

        pendingRows.push(row);
        count('inserted', table);
      }

      await insertRows(target, targetIdentity.schema, table, pendingRows, comparableColumns);
    }

    await mergeExact(
      'Card',
      (row) => ({
        ...row,
        savingsaccountid: savingsMap.get(row.savingsaccountid),
        createdby: mapUserId(row.createdby),
      }),
      (row) => savingsMap.has(row.savingsaccountid),
    );

    await mergeExact(
      'reciepients',
      (row) => ({
        ...row,
        bank: bankMap.get(row.bank),
        createdby: mapUserId(row.createdby),
      }),
      (row) => userMap.has(row.createdby) && bankMap.has(row.bank),
    );

    await mergeExact(
      'transaction',
      (row) => ({
        ...row,
        userid: mapUserId(row.userid),
        createdby: mapUserId(row.createdby),
        approvedby: mapUserId(row.approvedby),
        updatedby: mapUserId(row.updatedby),
      }),
      (row) => userMap.has(row.userid),
    );

    await mergeExact(
      'banktransaction',
      (row) => ({
        ...row,
        userid: mapUserId(row.userid),
        createdby: mapUserId(row.createdby),
      }),
      (row) => userMap.has(row.userid),
    );

    if (apply) {
      await target.query('COMMIT');
    } else {
      await target.query('ROLLBACK');
    }

    if (apply) {
      const reportDirectory = path.join(__dirname, '..', 'migration-reports');
      fs.mkdirSync(reportDirectory, { recursive: true });
      const reportPath = path.join(
        reportDirectory,
        `database-merge-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      );
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      report.reportPath = reportPath;
    }

    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await target.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(`Database merge failed: ${error.message}`);
  process.exitCode = 1;
});
