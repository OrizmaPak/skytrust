function required(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function databaseIdentity(connectionString) {
  const url = new URL(connectionString);

  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, ''),
    schema: url.searchParams.get('schema') || 'public',
  };
}

const databaseUrl = required('DATABASE_URL');
const database = databaseIdentity(databaseUrl);
const expectedDatabaseSchema = process.env.DATABASE_SCHEMA?.trim();

if (expectedDatabaseSchema && database.schema !== expectedDatabaseSchema) {
  throw new Error(
    `DATABASE_URL points to schema "${database.schema}"; expected "${expectedDatabaseSchema}"`,
  );
}

module.exports = Object.freeze({
  databaseUrl,
  database,
  expectedDatabaseSchema,
});
