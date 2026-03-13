const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const DEFAULT_ACCOUNT_FIELDS = [
  "default_sms_charge_account",
  "default_asset_account",
  "default_cash_account",
  "default_current_assets_account",
  "default_expense_account",
  "default_income_account",
  "default_equity_retained_earnings_account",
  "default_equity_does_not_close_account",
  "default_inventory_account",
  "default_other_asset_account",
  "default_cost_of_sales_account",
  "default_fixed_asset_account",
  "default_other_current_asset_account",
  "default_accounts_payable_account",
  "default_accounts_receivable_account",
  "default_accumulated_depreciation_account",
  "default_liabilities_account",
  "default_other_current_liabilities_account",
  "default_long_term_liabilities_account",
  "default_equity_account",
  "default_tax_account",
  "default_excess_account",
  "default_allocation_account",
  "default_property_account",
  "default_rotary_account"
];

const deleteAccount = async (req, res) => {
  const user = req.user;
  const id = req.params.id || req.query.id || req.body?.id;

  if (!id) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: false,
      message: "Account id is required",
      statuscode: StatusCodes.BAD_REQUEST,
      data: null,
      errors: ["Account id is required"]
    });
  }

  try {
    await pg.query("BEGIN");

    const accountResult = await pg.query(
      `SELECT * FROM sky."Accounts" WHERE id = $1`,
      [id]
    );

    if (accountResult.rows.length === 0) {
      await pg.query("ROLLBACK");
      await activityMiddleware(req, user.id, "Account not found for deletion", "ACCOUNT");
      return res.status(StatusCodes.NOT_FOUND).json({
        status: false,
        message: "Account not found",
        statuscode: StatusCodes.NOT_FOUND,
        data: null,
        errors: []
      });
    }

    const account = accountResult.rows[0];
    const accountNumberValue = Number(account.accountnumber);
    const accountNumber = String(account.accountnumber);

    const clearedDefaults = [];
    for (const field of DEFAULT_ACCOUNT_FIELDS) {
      const updateResult = await pg.query(
        `UPDATE sky."Organisationsettings"
         SET "${field}" = NULL
         WHERE "${field}" = $1`,
        [accountNumberValue]
      );

      if (updateResult.rowCount > 0) {
        clearedDefaults.push(field);
      }
    }

    const deletedTransactions = await pg.query(
      `DELETE FROM sky."transaction" WHERE accountnumber = $1`,
      [accountNumber]
    );

    const deletedBankTransactions = await pg.query(
      `DELETE FROM sky."banktransaction" WHERE accountnumber = $1`,
      [accountNumber]
    );

    const deletedLoanFees = await pg.query(
      `DELETE FROM sky."loanfee" WHERE glaccount = $1`,
      [accountNumber]
    );

    await pg.query(
      `DELETE FROM sky."Accounts" WHERE id = $1`,
      [id]
    );

    await pg.query("COMMIT");

    await activityMiddleware(
      req,
      user.id,
      `Account ${accountNumber} deleted successfully`,
      "ACCOUNT"
    );

    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Account deleted successfully",
      statuscode: StatusCodes.OK,
      data: {
        accountnumber: accountNumber,
        deletedtransactions: deletedTransactions.rowCount,
        deletedbanktransactions: deletedBankTransactions.rowCount,
        deletedloanfees: deletedLoanFees.rowCount,
        cleareddefaults: clearedDefaults
      },
      errors: []
    });
  } catch (error) {
    await pg.query("ROLLBACK");
    console.error("Unexpected Error:", error);
    await activityMiddleware(req, user.id, "An unexpected error occurred deleting account", "ACCOUNT");
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "An unexpected error occurred",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [error.message]
    });
  }
};

module.exports = { deleteAccount };
