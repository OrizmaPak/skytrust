const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

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

const DEBIT_NARRATIONS = [
  "Cash withdrawal",
  "ATM withdrawal",
  "POS purchase",
  "Transfer to beneficiary",
  "Utility bill payment",
  "School fees payment",
  "Loan repayment",
  "Airtime and data purchase",
  "Food and groceries",
  "Maintenance expense"
];

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

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

const buildReference = (accountnumber, txDate, index) => {
  const accountPart = String(accountnumber).slice(-4);
  const datePart = txDate.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `GEN-${accountPart}-${datePart}-${index + 1}-${randomPart}`;
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
    FROM sky."savings" s
    LEFT JOIN sky."User" u ON u.id = s.userid
    LEFT JOIN sky."savingsproduct" sp ON sp.id = s.savingsproductid
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
    FROM sky."loanaccounts" l
    LEFT JOIN sky."User" u ON u.id = l.userid
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
    FROM sky."rotaryaccount" r
    LEFT JOIN sky."User" u ON u.id = r.userid
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
    FROM sky."propertyaccount" p
    LEFT JOIN sky."User" u ON u.id = p.userid
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
    FROM sky."Accounts" a
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

const buildNarration = (type, whichaccount, accountName, amount) => {
  const base = pickRandom(type === "CREDIT" ? CREDIT_NARRATIONS : DEBIT_NARRATIONS);
  const accountLabel = whichaccount === "SAVINGS" ? "savings" : whichaccount.toLowerCase();
  return `${base} for ${accountName || accountLabel} account (${formatMoney(amount)})`;
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
    branch
  } = req.body;
  const user = req.user;

  const parsedEstimate = Number(estimatedamount ?? totalamount);
  const creditCount = Number(creditsno);
  const debitCount = Number(debitsno);

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
       FROM sky."transaction"
       WHERE accountnumber = $1 AND status = 'ACTIVE'`,
      [String(profile.accountnumber)]
    );

    const currentBalance = Number(balanceResult.rows[0]?.balance || 0);
    const accountBaseAmount = Number(profile.amount || 0);
    const estimatedBase = Math.max(parsedEstimate, 1000);
    const minimumTxnAmount = Math.max(250, Math.min(estimatedBase * 0.05, 5000));

    const openingBalance = roundToTwo(
      Math.max(currentBalance, accountBaseAmount * 0.1, estimatedBase * randomBetween(0.35, 0.8))
    );

    const targetCreditTotal = roundToTwo(
      creditCount > 0
        ? Math.max(estimatedBase * randomBetween(0.95, 1.35), creditCount * minimumTxnAmount)
        : 0
    );

    const safeDebitCeiling = openingBalance + targetCreditTotal - Math.max(estimatedBase * 0.15, 500);
    const targetDebitTotal = roundToTwo(
      debitCount > 0
        ? Math.max(
            Math.min(
              estimatedBase * randomBetween(0.3, 0.85),
              Math.max(safeDebitCeiling, debitCount * minimumTxnAmount)
            ),
            debitCount * minimumTxnAmount
          )
        : 0
    );

    const creditAmounts = splitWeightedAmount(targetCreditTotal, creditCount, minimumTxnAmount);
    let debitAmounts = splitWeightedAmount(
      Math.min(targetDebitTotal, Math.max(openingBalance + targetCreditTotal - 250, debitCount * minimumTxnAmount)),
      debitCount,
      minimumTxnAmount
    );

    let runningBalance = openingBalance;
    const allDates = Array.from({ length: creditCount + debitCount }, () => randomDateBetween(start, end))
      .sort((a, b) => a - b);

    const transactions = [];
    let remainingCredits = [...creditAmounts];
    let remainingDebits = [...debitAmounts];

    for (let index = 0; index < allDates.length; index++) {
      const txDate = allDates[index];
      const mustUseCredit = remainingCredits.length > 0 && (
        remainingDebits.length === 0 ||
        runningBalance < remainingDebits[remainingDebits.length - 1]
      );

      const shouldUseCredit = mustUseCredit || (
        remainingCredits.length > 0 &&
        (remainingDebits.length === 0 || Math.random() < 0.58)
      );

      const type = shouldUseCredit ? "CREDIT" : "DEBIT";
      const amount = shouldUseCredit ? remainingCredits.shift() : remainingDebits.shift();

      if (!amount || amount <= 0) {
        continue;
      }

      if (type === "DEBIT" && amount > runningBalance) {
        remainingCredits.unshift(amount);
        continue;
      }

      const reference = buildReference(profile.accountnumber, txDate, index);
      const tfrom = type === "CREDIT"
        ? (Math.random() < 0.7 ? "BANK" : "CASH")
        : (Math.random() < 0.65 ? "BANK" : "CASH");
      const description = buildNarration(type, profile.whichaccount, profile.accountname, amount);

      runningBalance = roundToTwo(
        type === "CREDIT" ? runningBalance + amount : runningBalance - amount
      );

      transactions.push({
        accountnumber: String(profile.accountnumber),
        userid: Number(profile.userid || userid || 0),
        currency: profile.currency || "NGN",
        credit: type === "CREDIT" ? amount : 0,
        debit: type === "DEBIT" ? amount : 0,
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
        ttype: type,
        tfrom,
        createdby: user?.id || 0,
        valuedate: txDate,
        reference,
        whichaccount: profile.whichaccount,
        voucher: "",
        tax: false
      });
    }

    // If some debits were skipped because of balance protection, convert the remainder to credits
    while (remainingDebits.length > 0) {
      const amount = remainingDebits.shift();
      const txDate = randomDateBetween(start, end);
      const reference = buildReference(profile.accountnumber, txDate, transactions.length);
      const description = `Reclassified inflow for ${profile.accountname || "account"} (${formatMoney(amount)})`;

      transactions.push({
        accountnumber: String(profile.accountnumber),
        userid: Number(profile.userid || userid || 0),
        currency: profile.currency || "NGN",
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
        tfrom: "BANK",
        createdby: user?.id || 0,
        valuedate: txDate,
        reference,
        whichaccount: profile.whichaccount,
        voucher: "",
        tax: false
      });
    }

    transactions.sort((a, b) => new Date(a.transactiondate) - new Date(b.transactiondate));

    await pg.query("BEGIN");
    try {
      for (const transaction of transactions) {
        await pg.query(
          `INSERT INTO sky."transaction" (
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

      await pg.query("COMMIT");
    } catch (error) {
      await pg.query("ROLLBACK");
      throw error;
    }

    const totalCredits = roundToTwo(transactions.reduce((sum, tx) => sum + Number(tx.credit || 0), 0));
    const totalDebits = roundToTwo(transactions.reduce((sum, tx) => sum + Number(tx.debit || 0), 0));

    await activityMiddleware(
      req,
      user.id,
      `Generated ${transactions.length} realistic transactions for ${profile.accountnumber}`,
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
        openingbalance: openingBalance,
        totalcredits: totalCredits,
        totaldebits: totalDebits,
        closingbalance: roundToTwo(openingBalance + totalCredits - totalDebits),
        generatedcount: transactions.length
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

module.exports = { generateTransactions };
