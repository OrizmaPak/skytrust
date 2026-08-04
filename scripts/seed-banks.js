require('dotenv').config();

const pg = require('../db/pg');

const FDIC_INSTITUTIONS_URL =
  'https://banks.data.fdic.gov/api/institutions?filters=ACTIVE:1&fields=NAME&limit=10000&format=json';
const BOE_BANKS_PAGE_URL =
  'https://www.bankofengland.co.uk/prudential-regulation/authorisations/which-firms-does-the-pra-regulate';

const COUNTRY_US = 'United States of America';
const COUNTRY_UK = 'United Kingdom';
const BATCH_SIZE = 500;

const cleanBankName = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();

const normalizeKey = (value) => cleanBankName(value).toLowerCase();

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const fetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
};

const fetchUsBanks = async () => {
  const payload = JSON.parse(await fetchText(FDIC_INSTITUTIONS_URL));

  return payload.data
    .map((record) => cleanBankName(record.data && record.data.NAME))
    .filter(Boolean)
    .map((bank) => ({ bank, country: COUNTRY_US }));
};

const resolveBoeCsvUrl = async () => {
  const html = await fetchText(BOE_BANKS_PAGE_URL);
  const match = html.match(/href="([^"]*banks-list-[^"]*\.csv)"/i);

  if (!match) {
    throw new Error('Could not locate the Bank of England PRA banks CSV link.');
  }

  return new URL(match[1], BOE_BANKS_PAGE_URL).toString();
};

const fetchUkBanks = async () => {
  const csvUrl = await resolveBoeCsvUrl();
  const csv = await fetchText(csvUrl);
  const rows = csv.split(/\r?\n/).map(parseCsvLine);

  return rows
    .filter((row) => row.length >= 3 && row[0] && row[1] && row[2])
    .filter((row) => row[0] !== 'Firm Name' && /^\d+$/.test(row[1]))
    .map((row) => cleanBankName(row[0]))
    .filter(Boolean)
    .map((bank) => ({ bank, country: COUNTRY_UK }));
};

const dedupeWithinSource = (banks) => {
  const seen = new Set();
  return banks.filter(({ bank, country }) => {
    const key = `${country}:${normalizeKey(bank)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const resolveCrossCountryNameCollisions = (banks) => {
  const countriesByName = new Map();

  banks.forEach(({ bank, country }) => {
    const key = normalizeKey(bank);
    if (!countriesByName.has(key)) countriesByName.set(key, new Set());
    countriesByName.get(key).add(country);
  });

  return banks.map(({ bank, country }) => {
    const countries = countriesByName.get(normalizeKey(bank));
    if (!countries || countries.size === 1) return { bank, country };

    return {
      bank: `${bank} (${country === COUNTRY_US ? 'US' : 'UK'})`,
      country,
    };
  });
};

const upsertBanks = async (banks) => {
  let upserted = 0;

  for (let start = 0; start < banks.length; start += BATCH_SIZE) {
    const batch = banks.slice(start, start + BATCH_SIZE);
    const placeholders = batch
      .map((_, index) => {
        const offset = index * 4;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
      })
      .join(', ');
    const values = batch.flatMap(({ bank, country }) => [bank, country, 'ACTIVE', 0]);

    const result = await pg.query(
      `
        INSERT INTO skytobi."listofbanks" (bank, country, status, createdby)
        VALUES ${placeholders}
        ON CONFLICT (bank)
        DO UPDATE SET
          country = EXCLUDED.country,
          status = EXCLUDED.status
      `,
      values
    );

    upserted += result.rowCount;
  }

  return upserted;
};

const main = async () => {
  const [usBanks, ukBanks] = await Promise.all([fetchUsBanks(), fetchUkBanks()]);
  const banks = resolveCrossCountryNameCollisions(dedupeWithinSource([...usBanks, ...ukBanks]));
  const upserted = await upsertBanks(banks);
  const counts = await pg.query(
    `
      SELECT country, COUNT(*)::int AS count
      FROM skytobi."listofbanks"
      WHERE country IN ($1, $2)
      GROUP BY country
      ORDER BY country
    `,
    [COUNTRY_UK, COUNTRY_US]
  );

  console.log(
    JSON.stringify(
      {
        fetched: {
          us: usBanks.length,
          uk: ukBanks.length,
          total: banks.length,
        },
        upserted,
        databaseCounts: counts.rows,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pg.end();
  });
