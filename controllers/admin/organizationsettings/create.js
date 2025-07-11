const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");
const { activityMiddleware } = require("../../../middleware/activity");

const organizationsettings = async (req, res) => {
  try {
    if (req.files) await uploadToGoogleDrive(req, res);

    // Destructure all fields with model defaults
    const {
      company_name,
      sms_sender_id,
      phone = "",
      mobile = "",
      email,
      address,
      logo,
      sms_charge = null,
      maintenace_charge = null,
      vat_rate_percent = 0,
      addition_savings_registration_charge = null,
      addition_loan_registration_charge = 0,
      allow_back_dated_transaction = "NO",
      allow_future_transaction = "NO",
      personal_account_overdrawn = false,
      set_accounting_year_end = null,
      schedule_maintenace_charge = "NO",
      sms_charge_members = "YES",
      minimum_credit_amount = 2000,
      minimum_credit_amount_penalty = 200,

      // Transaction prefixes
      personal_transaction_prefix = null,
      loan_transaction_prefix = null,
      rotary_transaction_prefix = "",
      gl_transaction_prefix = null,
      savings_transaction_prefix = null,
      property_transaction_prefix = "",

      // Account prefixes
      savings_account_prefix = null,
      personal_account_prefix = "DHF",
      loan_account_prefix = null,
      property_account_prefix = "",
      rotary_account_prefix = "",
      asset_account_prefix = null,
      cash_account_prefix = null,
      current_assets_account_prefix = null,
      expense_account_prefix = null,
      income_account_prefix = null,
      equity_retained_earnings_account_prefix = null,
      equity_does_not_close_prefix = null,
      inventory_account_prefix = null,
      other_asset_account_prefix = null,
      cost_of_sales_account_prefix = null,
      fixed_asset_account_prefix = null,
      other_current_asset_account_prefix = null,
      accounts_payable_account_prefix = null,
      accounts_receivable_account_prefix = null,
      accumulated_depreciation_account_prefix = null,
      liabilities_account_prefix = null,
      other_current_liabilities_account_prefix = null,
      long_term_liabilities_account_prefix = null,
      equity_account_prefix = null,

      // Default accounts
      default_sms_charge_account = null,
      default_asset_account = null,
      default_cash_account = null,
      default_current_assets_account = null,
      default_expense_account = null,
      default_income_account = null,
      default_equity_retained_earnings_account = null,
      default_equity_does_not_close_account = null,
      default_inventory_account = null,
      default_other_asset_account = null,
      default_cost_of_sales_account = null,
      default_fixed_asset_account = null,
      default_other_current_asset_account = null,
      default_accounts_payable_account = null,
      default_accounts_receivable_account = null,
      default_accumulated_depreciation_account = null,
      default_liabilities_account = null,
      default_other_current_liabilities_account = null,
      default_long_term_liabilities_account = null,
      default_equity_account = null,
      default_tax_account = null,
      default_excess_account = null,
      default_allocation_account = 0,
      default_property_account = 0,
      default_rotary_account = 0,
      status = "ACTIVE"
    } = req.body;

    // Validate required fields
    const requiredFields = {
      company_name: "Company name",
      sms_sender_id: "SMS sender ID",
      email: "Email",
      address: "Address"
    };

    const errors = Object.entries(requiredFields)
      .filter(([field]) => !req.body[field])
      .map(([field, name]) => ({ field, message: `${name} is required` }));

    // Check for duplicate prefixes
    const prefixFields = [
      personal_transaction_prefix,
      loan_transaction_prefix,
      rotary_transaction_prefix,
      gl_transaction_prefix,
      savings_transaction_prefix,
      property_transaction_prefix,
      savings_account_prefix,
      personal_account_prefix,
      loan_account_prefix,
      property_account_prefix,
      rotary_account_prefix,
      asset_account_prefix,
      cash_account_prefix,
      current_assets_account_prefix,
      expense_account_prefix,
      income_account_prefix,
      equity_retained_earnings_account_prefix,
      equity_does_not_close_prefix,
      inventory_account_prefix,
      other_asset_account_prefix,
      cost_of_sales_account_prefix,
      fixed_asset_account_prefix,
      other_current_asset_account_prefix,
      accounts_payable_account_prefix,
      accounts_receivable_account_prefix,
      accumulated_depreciation_account_prefix,
      liabilities_account_prefix,
      other_current_liabilities_account_prefix,
      long_term_liabilities_account_prefix,
      equity_account_prefix
    ];

    const prefixSet = new Set();
    const duplicatePrefixes = prefixFields.filter(prefix => {
      if (prefix && prefixSet.has(prefix)) return true;
      prefixSet.add(prefix);
      return false;
    });

    if (duplicatePrefixes.length > 0) {
      errors.push(...duplicatePrefixes.map(prefix => ({
        field: "prefixes",
        message: `Duplicate prefix value: ${prefix}`
      })));
    }

    if (errors.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Validation errors",
        errors
      });
    }

    // Validate default accounts
    const defaultAccounts = [
      default_sms_charge_account,
      default_asset_account,
      default_cash_account,
      default_current_assets_account,
      default_expense_account,
      default_income_account,
      default_equity_retained_earnings_account,
      default_equity_does_not_close_account,
      default_inventory_account,
      default_other_asset_account,
      default_cost_of_sales_account,
      default_fixed_asset_account,
      default_other_current_asset_account,
      default_accounts_payable_account,
      default_accounts_receivable_account,
      default_accumulated_depreciation_account,
      default_liabilities_account,
      default_other_current_liabilities_account,
      default_long_term_liabilities_account,
      default_equity_account,
      default_tax_account,
      default_excess_account,
      default_allocation_account,
      default_property_account,
      default_rotary_account
    ];

    for (const account of defaultAccounts.filter(a => a)) {
      const { rowCount } = await pg.query(
        `SELECT 1 FROM skyeu."Accounts" WHERE accountnumber = $1`,
        [account]
      );
      if (rowCount === 0) {
        errors.push({
          field: "default_accounts",
          message: `Account ${account} not found`
        });
      }
    }

    if (errors.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Account validation failed",
        errors
      });
    }

    // Prepare data object
    const orgData = {
      company_name,
      sms_sender_id,
      phone,
      mobile,
      email,
      address,
      logo: logo || null,
      sms_charge: parseNumber(sms_charge),
      maintenace_charge: parseNumber(maintenace_charge),
      vat_rate_percent: parseNumber(vat_rate_percent, 0),
      addition_savings_registration_charge: parseNumber(addition_savings_registration_charge),
      addition_loan_registration_charge: parseNumber(addition_loan_registration_charge, 0),
      allow_back_dated_transaction,
      allow_future_transaction,
      personal_account_overdrawn,
      set_accounting_year_end,
      schedule_maintenace_charge,
      sms_charge_members,
      minimum_credit_amount: parseNumber(minimum_credit_amount, 2000),
      minimum_credit_amount_penalty: parseNumber(minimum_credit_amount_penalty, 200),
      status,

      // Transaction prefixes
      personal_transaction_prefix,
      loan_transaction_prefix,
      rotary_transaction_prefix,
      gl_transaction_prefix,
      savings_transaction_prefix,
      property_transaction_prefix,

      // Account prefixes
      savings_account_prefix,
      personal_account_prefix,
      loan_account_prefix,
      property_account_prefix,
      rotary_account_prefix,
      asset_account_prefix,
      cash_account_prefix,
      current_assets_account_prefix,
      expense_account_prefix,
      income_account_prefix,
      equity_retained_earnings_account_prefix,
      equity_does_not_close_prefix,
      inventory_account_prefix,
      other_asset_account_prefix,
      cost_of_sales_account_prefix,
      fixed_asset_account_prefix,
      other_current_asset_account_prefix,
      accounts_payable_account_prefix,
      accounts_receivable_account_prefix,
      accumulated_depreciation_account_prefix,
      liabilities_account_prefix,
      other_current_liabilities_account_prefix,
      long_term_liabilities_account_prefix,
      equity_account_prefix,

      // Default accounts
      default_sms_charge_account: parseNumber(default_sms_charge_account),
      default_asset_account: parseNumber(default_asset_account),
      default_cash_account: parseNumber(default_cash_account),
      default_current_assets_account: parseNumber(default_current_assets_account),
      default_expense_account: parseNumber(default_expense_account),
      default_income_account: parseNumber(default_income_account),
      default_equity_retained_earnings_account: parseNumber(default_equity_retained_earnings_account),
      default_equity_does_not_close_account: parseNumber(default_equity_does_not_close_account),
      default_inventory_account: parseNumber(default_inventory_account),
      default_other_asset_account: parseNumber(default_other_asset_account),
      default_cost_of_sales_account: parseNumber(default_cost_of_sales_account),
      default_fixed_asset_account: parseNumber(default_fixed_asset_account),
      default_other_current_asset_account: parseNumber(default_other_current_asset_account),
      default_accounts_payable_account: parseNumber(default_accounts_payable_account),
      default_accounts_receivable_account: parseNumber(default_accounts_receivable_account),
      default_accumulated_depreciation_account: parseNumber(default_accumulated_depreciation_account),
      default_liabilities_account: parseNumber(default_liabilities_account),
      default_other_current_liabilities_account: parseNumber(default_other_current_liabilities_account),
      default_long_term_liabilities_account: parseNumber(default_long_term_liabilities_account),
      default_equity_account: parseNumber(default_equity_account),
      default_tax_account: parseNumber(default_tax_account),
      default_excess_account: parseNumber(default_excess_account),
      default_allocation_account: parseNumber(default_allocation_account, 0),
      default_property_account: parseNumber(default_property_account, 0),
      default_rotary_account: parseNumber(default_rotary_account, 0)
    };

    // Database operation
    const { rows: existing } = await pg.query('SELECT * FROM skyeu."Organisationsettings"');
    
    if (existing.length === 0) {
      // Insert new settings
      const columns = Object.keys(orgData).map(k => `"${k}"`).join(', ');
      const values = Object.values(orgData);
      const placeholders = values.map((_, i) => `$${i+1}`).join(', ');

      const { rows } = await pg.query(
        `INSERT INTO skyeu."Organisationsettings" (${columns}) 
         VALUES (${placeholders}) RETURNING id`,
        values
      );

      await activityMiddleware(
        res,
        req.user.id,
        `Created organization settings for ${company_name}`,
        "ORGANIZATION_SETTINGS"
      );

      return res.status(StatusCodes.CREATED).json({
        status: true,
        message: "Organization settings created",
        data: { id: rows[0].id }
      });
    } else {
      // Update existing settings using COALESCE
      const updates = Object.entries(orgData)
        .map(([key, val], i) => `"${key}" = COALESCE($${i+1}, "${key}")`)
        .join(', ');

      const values = Object.values(orgData);
      const idToUpdate = existing[0].id;

      await pg.query(
        `UPDATE skyeu."Organisationsettings" 
         SET ${updates} WHERE id = $${values.length + 1}`,
        [...values, idToUpdate]
      );

      await activityMiddleware(
        res,
        req.user.id,
        `Updated organization settings for ${company_name}`,
        "ORGANIZATION_SETTINGS"
      );

      return res.status(StatusCodes.OK).json({
        status: true,
        message: "Organization settings updated",
        data: { id: idToUpdate }
      });
    }
  } catch (err) {
    console.error("Organization settings error:", err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "Internal server error",
      errors: process.env.NODE_ENV === "development" ? [err.message] : []
    });
  }
};

function parseNumber(value, defaultValue = null) {
  if (value === null || value === undefined) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

module.exports = { organizationsettings }; 