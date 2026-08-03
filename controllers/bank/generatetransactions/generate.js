const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const transactionCatalog = require("../../../data/transaction_categories_usd.json");

const CREDIT_NARRATIONS = [
  "Salary payment",
  "Cash deposit",
  "Transfer from customer",
  "Online transfer received",
  "Business sales proceeds",
  "Contribution payment",
  "Project settlement",
  "Commission payment",
  "Branch lodgement",
  "Savings top up"
];

const RANDOM_COUNTERPARTIES = [
  "John A.",
  "Mary K.",
  "David O.",
  "Angela M.",
  "S. Ibrahim",
  "T. Williams",
  "Eze Stores",
  "Metro Bank",
  "BluePoint Ltd",
  "City Mart",
  "Prime Fuel",
  "Apex Services",
  "Household Account",
  "Vendor Account",
  "Business Account"
];

const REFERENCE_PREFIXES = ["RSB", "APN", "TRF", "NIP", "MB", "FT"];
const MAX_BALANCE_DEVIATION = 100;

const roundToTwo = (value) => Number(Number(value).toFixed(2));
const randomBetween = (min, max) => min + Math.random() * (max - min);
const randomIntBetween = (min, max) => {
  const start = Math.ceil(min);
  const end = Math.floor(max);
  return Math.floor(Math.random() * (end - start + 1)) + start;
};
const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];
const randomDateBetween = (start, end) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const buildReference = (accountnumber, txDate, index) => {
  const prefix = pickRandom(REFERENCE_PREFIXES);
  const accountPart = String(accountnumber).slice(-4);
  const datePart = txDate.toISOString().slice(2, 10).replace(/-/g, "");
  const serialPart = String(index + 1).padStart(3, "0");
  const randomPart = String(randomIntBetween(100000, 999999));
  return `${prefix}${datePart}${accountPart}${serialPart}${randomPart}`;
};

const splitWeightedAmount = (total, count, minimumAmount) => {
  if (count <= 0) return [];

  const safeMinimum = Math.max(minimumAmount, 1);
  const totalCents = Math.max(
    Math.round(total * 100),
    count * Math.round(safeMinimum * 100)
  );
  const minCents = Math.round(safeMinimum * 100);
  let remaining = totalCents - count * minCents;

  const weights = Array.from({ length: count }, () => Math.pow(Math.random(), 1.8) + 0.35);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const allocations = weights.map((weight) => minCents + Math.floor((weight / weightSum) * remaining));
  let used = allocations.reduce((sum, value) => sum + value, 0);

  while (used < totalCents) {
    allocations[randomIntBetween(0, allocations.length - 1)] += 1;
    used += 1;
  }

  return allocations
    .map((amount) => roundToTwo(amount / 100))
    .sort((a, b) => b - a);
};

const resolveAccountProfile = async (accountnumber, fallbackUserid, fallbackBranch) => {
  const accountValue = String(accountnumber);

  const savingsQuery = `
    SELECT
      s.accountnumber::text AS accountnumber,
      s.userid,
      s.branch,
      s.registrationpoint,
      s.status,
      s.amount,
      COALESCE(sp.currency, 'NGN') AS currency,
      CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS accountname
    FROM skytobi."savings" s
    LEFT JOIN skytobi."User" u ON u.id = s.userid
    LEFT JOIN skytobi."savingsproduct" sp ON sp.id = s.savingsproductid
    WHERE s.accountnumber::text = $1
    LIMIT 1
  `;

  const loanQuery = `
    SELECT
      l.accountnumber::text AS accountnumber,
      l.userid,
      l.branch,
      l.registrationpoint,
      l.status,
      l.loanamount AS amount,
      'NGN' AS currency,
      CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS accountname
    FROM skytobi."loanaccounts" l
    LEFT JOIN skytobi."User" u ON u.id = l.userid
    WHERE l.accountnumber::text = $1
    LIMIT 1
  `;

  const rotaryQuery = `
    SELECT
      r.accountnumber::text AS accountnumber,
      r.userid,
      r.branch,
      r.registrationpoint,
      r.status,
      r.amount,
      'NGN' AS currency,
      CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS accountname
    FROM skytobi."rotaryaccount" r
    LEFT JOIN skytobi."User" u ON u.id = r.userid
    WHERE r.accountnumber::text = $1
    LIMIT 1
  `;

  const propertyQuery = `
    SELECT
      p.accountnumber::text AS accountnumber,
      p.userid,
      NULL::integer AS branch,
      NULL::integer AS registrationpoint,
      p.status,
      p.registrationcharge::float AS amount,
      'NGN' AS currency,
      CONCAT(u.firstname, ' ', u.lastname, ' ', COALESCE(u.othernames, '')) AS accountname
    FROM skytobi."propertyaccount" p
    LEFT JOIN skytobi."User" u ON u.id = p.userid
    WHERE p.accountnumber::text = $1
    LIMIT 1
  `;

  const glQuery = `
    SELECT
      a.accountnumber::text AS accountnumber,
      $2::integer AS userid,
      $3::integer AS branch,
      NULL::integer AS registrationpoint,
      a.status,
      0::float AS amount,
      'NGN' AS currency,
      COALESCE(a.groupname, a.accountnumber::text) AS accountname
    FROM skytobi."Accounts" a
    WHERE a.accountnumber::text = $1
    LIMIT 1
  `;

  const lookups = [
    { whichaccount: "SAVINGS", query: savingsQuery, values: [accountValue] },
    { whichaccount: "LOAN", query: loanQuery, values: [accountValue] },
    { whichaccount: "ROTARY", query: rotaryQuery, values: [accountValue] },
    { whichaccount: "PROPERTY", query: propertyQuery, values: [accountValue] },
    { whichaccount: "GLACCOUNT", query: glQuery, values: [accountValue, fallbackUserid || 0, fallbackBranch || 0] }
  ];

  for (const lookup of lookups) {
    const result = await pg.query(lookup.query, lookup.values);
    if (result.rows.length > 0) {
      return { ...result.rows[0], whichaccount: lookup.whichaccount };
    }
  }

  return null;
};

const buildCreditNarration = () => {
  const base = pickRandom(CREDIT_NARRATIONS);
  const useCounterparty = Math.random() < 0.45;
  if (!useCounterparty) {
    return base;
  }

  const patterns = [
    `${base} from ${pickRandom(RANDOM_COUNTERPARTIES)}`,
    `${base} via ${pickRandom(RANDOM_COUNTERPARTIES)}`,
    `${base} - ${pickRandom(RANDOM_COUNTERPARTIES)}`
  ];

  return pickRandom(patterns);
};

const normalizeDebitDescription = (description) => {
  const replacements = [
    [/Generator fuel purchase/gi, "Purchase of fuel for generator"],
    [/House cleaning service/gi, "House cleaning payment"],
    [/Laundry service payment/gi, "Laundry payment"],
    [/Plumbing repair payment/gi, "Plumbing repair"],
    [/Electrician repair service/gi, "Electrician service payment"],
    [/Air conditioner servicing/gi, "Air conditioner service"],
    [/Home painting deposit/gi, "Deposit for home painting"],
    [/Roof repair payment/gi, "Roof repair"],
    [/Tiles replacement payment/gi, "Tiles replacement"],
    [/TV repair payment/gi, "TV repair service"],
    [/CCTV maintenance payment/gi, "CCTV maintenance"],
    [/Door lock replacement/gi, "Door lock replacement payment"]
  ];

  let output = description;
  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }

  return output;
};

const buildDebitNarration = (plan) => {
  const base = normalizeDebitDescription(plan.description);
  const useCounterparty = Math.random() < 0.35;

  if (!useCounterparty) {
    return base;
  }

  const counterparty = pickRandom(RANDOM_COUNTERPARTIES);
  const patterns = [
    `${base} - ${counterparty}`,
    `${base} to ${counterparty}`,
    `${base} via ${counterparty}`
  ];

  return pickRandom(patterns);
};

const getTransactionCategories = async (req, res) => {
  const categories = (transactionCatalog.transaction_categories || []).map((category) => ({
    category_name: category.category_name,
    min_transaction_amount: category.min_transaction_amount,
    max_transaction_amount: category.max_transaction_amount,
    description_count: category.transaction_descriptions.length,
    transaction_descriptions: category.transaction_descriptions
  }));

  return res.status(StatusCodes.OK).json({
    status: true,
    message: "Transaction categories retrieved successfully",
    statuscode: StatusCodes.OK,
    data: {
      currency: transactionCatalog.currency || "USD",
      categories
    },
    errors: []
  });
};

const parseSelectedCategories = (selectedCategories) => {
  if (!selectedCategories) return [];
  if (Array.isArray(selectedCategories)) return selectedCategories;

  if (typeof selectedCategories === "string") {
    try {
      const parsed = JSON.parse(selectedCategories);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return selectedCategories
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const buildDebitBlueprints = (selectedCategoryNames, debitCount, targetDebitTotal) => {
  const allCategories = transactionCatalog.transaction_categories || [];
  const activeCategories = selectedCategoryNames.length > 0
    ? allCategories.filter((category) => selectedCategoryNames.includes(category.category_name))
    : allCategories;

  if (activeCategories.length === 0) {
    throw new Error("No matching transaction categories were found.");
  }

  const descriptionPool = activeCategories.flatMap((category) =>
    category.transaction_descriptions.map((description) => ({
      category_name: category.category_name,
      category_min: Number(category.min_transaction_amount || description.min_amount || 1),
      category_max: Number(category.max_transaction_amount || description.max_amount || 500),
      description: description.description,
      min_amount: Number(description.min_amount || category.min_transaction_amount || 1),
      max_amount: Number(description.max_amount || category.max_transaction_amount || 500)
    }))
  );

  const blueprints = Array.from({ length: debitCount }, () => pickRandom(descriptionPool));
  const minTotal = roundToTwo(blueprints.reduce((sum, item) => sum + item.min_amount, 0));
  const maxTotal = roundToTwo(blueprints.reduce((sum, item) => sum + item.max_amount, 0));
  const targetTotal = roundToTwo(Math.min(maxTotal, Math.max(minTotal, targetDebitTotal)));

  let remaining = Math.max(0, roundToTwo(targetTotal - minTotal));
  const debitPlans = blueprints.map((item) => ({
    ...item,
    amount: roundToTwo(item.min_amount)
  }));

  const shuffled = [...debitPlans].sort(() => Math.random() - 0.5);
  for (const plan of shuffled) {
    if (remaining <= 0) break;

    const categoryCap = Math.min(plan.max_amount, plan.category_max);
    const availableExtra = roundToTwo(Math.max(0, categoryCap - plan.amount));
    if (availableExtra <= 0) continue;

    const extra = roundToTwo(Math.min(availableExtra, randomBetween(0, remaining)));
    plan.amount = roundToTwo(plan.amount + extra);
    remaining = roundToTwo(remaining - extra);
  }

  if (remaining > 0 && debitPlans.length > 0) {
    const last = debitPlans[debitPlans.length - 1];
    last.amount = roundToTwo(Math.min(last.max_amount, last.amount + remaining));
  }

  return debitPlans;
};

const generateTransactions = async (req, res) => {
  const {
    accountnumber,
    startdate,
    enddate,
    totalamount,
    estimatedamount,
    creditsno,
    debitsno,
    userid,
    branch,
    selectedcategories
  } = req.body;
  const user = req.user;

  const parsedEstimate = Number(estimatedamount ?? totalamount);
  const creditCount = Number(creditsno);
  const debitCount = Number(debitsno);
  const resolvedCreditCount = creditCount === 0 && debitCount > 0 ? 1 : creditCount;
  const resolvedDebitCount = debitCount === 0 && creditCount > 0 ? 1 : debitCount;
  const selectedCategoryNames = parseSelectedCategories(selectedcategories);

  if (
    !accountnumber ||
    !startdate ||
    !enddate ||
    !Number.isFinite(parsedEstimate) ||
    parsedEstimate <= 0 ||
    !Number.isInteger(creditCount) ||
    creditCount < 0 ||
    !Number.isInteger(debitCount) ||
    debitCount < 0 ||
    creditCount + debitCount <= 0
  ) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: false,
      message: "Missing required fields",
      statuscode: StatusCodes.BAD_REQUEST,
      data: null,
      errors: [
        "accountnumber, startdate, enddate, estimatedamount (> 0), and at least one credit or debit count are required"
      ]
    });
  }

  const start = new Date(startdate);
  const end = new Date(enddate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: false,
      message: "Invalid transaction date range",
      statuscode: StatusCodes.BAD_REQUEST,
      data: null,
      errors: ["startdate must be before or equal to enddate"]
    });
  }

  try {
    const profile = await resolveAccountProfile(accountnumber, userid, branch);

    if (!profile) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: false,
        message: "Account not found",
        statuscode: StatusCodes.NOT_FOUND,
        data: null,
        errors: ["No matching account profile was found for transaction generation"]
      });
    }

    if (profile.status !== "ACTIVE") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Only active accounts can receive generated transactions",
        statuscode: StatusCodes.BAD_REQUEST,
        data: null,
        errors: ["The selected account is not active"]
      });
    }

    const balanceResult = await pg.query(
      `SELECT COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) AS balance
       FROM skytobi."transaction"
       WHERE accountnumber = $1 AND status = 'ACTIVE'`,
      [String(profile.accountnumber)]
    );

    const currentBalance = Number(balanceResult.rows[0]?.balance || 0);
    const accountBaseAmount = Number(profile.amount || 0);
    const estimatedBase = Math.max(parsedEstimate, 100);
    const openingBalance = roundToTwo(
      Math.max(currentBalance, accountBaseAmount * 0.1, estimatedBase * randomBetween(0.5, 0.95))
    );

    const minimumCreditAmount = Math.max(25, Math.min(estimatedBase * 0.05, 3000));
    const minimumDebitAmount = 5;
    const targetDebitTotal = roundToTwo(
      resolvedDebitCount > 0
        ? Math.max(estimatedBase, resolvedDebitCount * minimumDebitAmount)
        : 0
    );

    const debitPlans = buildDebitBlueprints(selectedCategoryNames, resolvedDebitCount, targetDebitTotal);
    const debitTotal = roundToTwo(debitPlans.reduce((sum, plan) => sum + Number(plan.amount || 0), 0));

    const preferredNetEffect = 0;
    const clampedNetEffect = roundToTwo(
      Math.max(-MAX_BALANCE_DEVIATION, Math.min(MAX_BALANCE_DEVIATION, preferredNetEffect))
    );
    const targetCreditTotal = roundToTwo(Math.max(resolvedCreditCount * minimumCreditAmount, debitTotal + clampedNetEffect));
    const creditAmounts = splitWeightedAmount(targetCreditTotal, resolvedCreditCount, minimumCreditAmount);

    const allDates = Array.from({ length: resolvedCreditCount + resolvedDebitCount }, () => randomDateBetween(start, end))
      .sort((a, b) => a - b);

    let runningBalance = openingBalance;
    let remainingCredits = [...creditAmounts];
    let remainingDebits = [...debitPlans];
    const transactions = [];

    for (let index = 0; index < allDates.length; index++) {
      const txDate = allDates[index];
      const mustUseCredit = remainingCredits.length > 0 && (
        remainingDebits.length === 0 ||
        runningBalance < remainingDebits[remainingDebits.length - 1].amount
      );

      const shouldUseCredit = mustUseCredit || (
        remainingCredits.length > 0 &&
        (remainingDebits.length === 0 || Math.random() < 0.5)
      );

      if (shouldUseCredit) {
        const amount = remainingCredits.shift();
        if (!amount || amount <= 0) continue;

        const reference = buildReference(profile.accountnumber, txDate, index);
        const description = buildCreditNarration();

        runningBalance = roundToTwo(runningBalance + amount);
        transactions.push({
          accountnumber: String(profile.accountnumber),
          userid: Number(profile.userid || userid || 0),
          currency: profile.currency || transactionCatalog.currency || "USD",
          credit: amount,
          debit: 0,
          description,
          image: null,
          branch: profile.branch ?? Number(branch || 0),
          registrationpoint: profile.registrationpoint ?? 0,
          dateadded: txDate,
          approvedby: user?.id || 0,
          status: "ACTIVE",
          updateddated: null,
          transactiondate: txDate,
          transactiondesc: description,
          transactionref: reference,
          cashref: "",
          updatedby: null,
          ttype: "CREDIT",
          tfrom: Math.random() < 0.7 ? "BANK" : "CASH",
          createdby: user?.id || 0,
          valuedate: txDate,
          reference,
          whichaccount: profile.whichaccount,
          voucher: "",
          tax: false,
          category_name: null
        });
      } else {
        const plan = remainingDebits.shift();
        if (!plan || plan.amount <= 0) continue;

        if (plan.amount > runningBalance) {
          remainingCredits.unshift(plan.amount);
          continue;
        }

        const reference = buildReference(profile.accountnumber, txDate, index);
        const description = buildDebitNarration(plan);

        runningBalance = roundToTwo(runningBalance - plan.amount);
        transactions.push({
          accountnumber: String(profile.accountnumber),
          userid: Number(profile.userid || userid || 0),
          currency: profile.currency || transactionCatalog.currency || "USD",
          credit: 0,
          debit: plan.amount,
          description,
          image: null,
          branch: profile.branch ?? Number(branch || 0),
          registrationpoint: profile.registrationpoint ?? 0,
          dateadded: txDate,
          approvedby: user?.id || 0,
          status: "ACTIVE",
          updateddated: null,
          transactiondate: txDate,
          transactiondesc: description,
          transactionref: reference,
          cashref: "",
          updatedby: null,
          ttype: "DEBIT",
          tfrom: Math.random() < 0.65 ? "BANK" : "CASH",
          createdby: user?.id || 0,
          valuedate: txDate,
          reference,
          whichaccount: profile.whichaccount,
          voucher: "",
          tax: false,
          category_name: plan.category_name
        });
      }
    }

    transactions.sort((a, b) => new Date(a.transactiondate) - new Date(b.transactiondate));

    await pg.withTransaction(async (client) => {
      for (const transaction of transactions) {
        await client.query(
          `INSERT INTO skytobi."transaction" (
            accountnumber,
            userid,
            currency,
            credit,
            debit,
            description,
            image,
            branch,
            registrationpoint,
            dateadded,
            approvedby,
            status,
            updateddated,
            transactiondate,
            transactiondesc,
            transactionref,
            cashref,
            updatedby,
            ttype,
            tfrom,
            createdby,
            valuedate,
            reference,
            whichaccount,
            voucher,
            tax
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
          )`,
          [
            transaction.accountnumber,
            transaction.userid,
            transaction.currency,
            transaction.credit,
            transaction.debit,
            transaction.description,
            transaction.image,
            transaction.branch,
            transaction.registrationpoint,
            transaction.dateadded,
            transaction.approvedby,
            transaction.status,
            transaction.updateddated,
            transaction.transactiondate,
            transaction.transactiondesc,
            transaction.transactionref,
            transaction.cashref,
            transaction.updatedby,
            transaction.ttype,
            transaction.tfrom,
            transaction.createdby,
            transaction.valuedate,
            transaction.reference,
            transaction.whichaccount,
            transaction.voucher,
            transaction.tax
          ]
        );
      }
    });

    const totalCredits = roundToTwo(transactions.reduce((sum, tx) => sum + Number(tx.credit || 0), 0));
    const totalDebits = roundToTwo(transactions.reduce((sum, tx) => sum + Number(tx.debit || 0), 0));
    const netEffect = roundToTwo(totalCredits - totalDebits);

    await activityMiddleware(
      req,
      user.id,
      `Generated ${transactions.length} category-based transactions for ${profile.accountnumber}`,
      "TRANSACTION"
    );

    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Transactions generated successfully",
      statuscode: StatusCodes.OK,
      data: transactions,
      summary: {
        accountnumber: String(profile.accountnumber),
        whichaccount: profile.whichaccount,
        currency: profile.currency || transactionCatalog.currency || "USD",
        currentbalancebefore: roundToTwo(currentBalance),
        openingbalance: openingBalance,
        totalcredits: totalCredits,
        totaldebits: totalDebits,
        neteffect: netEffect,
        closingbalance: roundToTwo(currentBalance + netEffect),
        generatedcount: transactions.length,
        selectedcategories: selectedCategoryNames.length > 0 ? selectedCategoryNames : "ALL"
      },
      errors: []
    });
  } catch (error) {
    console.error("Unexpected Error:", error);
    await activityMiddleware(req, user.id, "An unexpected error occurred generating transactions", "TRANSACTION");

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "An unexpected error occurred",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [error.message]
    });
  }
};

module.exports = {
  generateTransactions,
  getTransactionCategories
};
