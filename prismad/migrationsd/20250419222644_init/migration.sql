-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "Module" AS ENUM ('AUTH');

-- CreateEnum
CREATE TYPE "Acc" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "Yn" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "accounttype" AS ENUM ('ASSET', 'CASH', 'CURRENT_ASSETS', 'EXPENSE', 'INCOME', 'EQUITY_RETAINED_EARNINGS', 'EQUITY_DOES_NOT_CLOSE', 'INVENTORY', 'OTHER_ASSET', 'COST_OF_SALES', 'FIXED_ASSET', 'OTHER_CURRENT_ASSET', 'ACCOUNTS_PAYABLE', 'ACCOUNTS_RECEIVABLE', 'ACCUMULATED_DEPRECIATION', 'LIABILITIES', 'OTHER_CURRENT_LIABILITIES', 'LONG_TERM_LIABILITIES', 'EQUITY');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "othernames" TEXT,
    "image" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT,
    "state" TEXT,
    "emailverified" TIMESTAMP(3),
    "address" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "permissions" TEXT,
    "userpermissions" TEXT DEFAULT '',
    "password" TEXT NOT NULL,
    "officeaddress" TEXT,
    "image2" TEXT,
    "gender" TEXT,
    "occupation" TEXT,
    "lga" TEXT,
    "town" TEXT,
    "maritalstatus" TEXT,
    "spousename" TEXT,
    "stateofresidence" TEXT,
    "lgaofresidence" TEXT,
    "nextofkinfullname" TEXT,
    "nextofkinphone" TEXT,
    "nextofkinrelationship" TEXT,
    "nextofkinaddress" TEXT,
    "nextofkinofficeaddress" TEXT,
    "nextofkinoccupation" TEXT,
    "dateofbirth" TIMESTAMP(3),
    "branch" INTEGER DEFAULT 1,
    "registrationpoint" INTEGER NOT NULL DEFAULT 0,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastupdated" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdby" INTEGER NOT NULL DEFAULT 0,
    "pin" TEXT DEFAULT '',
    "level" INTEGER DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roles" (
    "role" TEXT NOT NULL,
    "permissions" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Roles_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "department" TEXT NOT NULL,
    "branch" INTEGER NOT NULL,
    "category" TEXT DEFAULT 'STORE',
    "applyforsales" TEXT DEFAULT 'JUST DEPARTMENT',
    "userid" INTEGER,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastupdated" TIMESTAMP(3),
    "createdby" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefineMember" (
    "id" SERIAL NOT NULL,
    "member" TEXT NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastupdated" TIMESTAMP(3),
    "addmember" TEXT NOT NULL DEFAULT 'YES',
    "createdby" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DefineMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" SERIAL NOT NULL,
    "member" INTEGER NOT NULL DEFAULT 1,
    "userid" INTEGER NOT NULL,
    "createdby" INTEGER NOT NULL DEFAULT 0,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastupdated" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" SERIAL NOT NULL,
    "member" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "userid" INTEGER DEFAULT 0,
    "branch" INTEGER DEFAULT 0,
    "createdby" INTEGER NOT NULL DEFAULT 0,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastupdated" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "activity" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'AUTH',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "sessiontoken" TEXT NOT NULL,
    "userid" INTEGER NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "device" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "branch" TEXT NOT NULL,
    "country" TEXT,
    "state" TEXT,
    "lga" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastupdated" TIMESTAMP(3),
    "userid" INTEGER,
    "createdby" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisationsettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "company_name" TEXT NOT NULL,
    "sms_sender_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "mobile" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "logo" TEXT,
    "sms_charge" DOUBLE PRECISION,
    "maintenace_charge" DOUBLE PRECISION,
    "vat_rate_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "addition_savings_registration_charge" DOUBLE PRECISION,
    "addition_loan_registration_charge" DOUBLE PRECISION DEFAULT 0,
    "allow_back_dated_transaction" TEXT NOT NULL DEFAULT 'NO',
    "allow_future_transaction" TEXT NOT NULL DEFAULT 'NO',
    "personal_account_overdrawn" BOOLEAN NOT NULL DEFAULT false,
    "set_accounting_year_end" TIMESTAMP(3),
    "schedule_maintenace_charge" TEXT NOT NULL DEFAULT 'NO',
    "sms_charge_members" TEXT NOT NULL DEFAULT 'YES',
    "minimum_credit_amount" DOUBLE PRECISION NOT NULL DEFAULT 2000,
    "minimum_credit_amount_penalty" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "personal_transaction_prefix" TEXT,
    "loan_transaction_prefix" TEXT,
    "rotary_transaction_prefix" TEXT DEFAULT '',
    "gl_transaction_prefix" TEXT,
    "savings_transaction_prefix" TEXT,
    "property_transaction_prefix" TEXT DEFAULT '',
    "savings_account_prefix" TEXT,
    "personal_account_prefix" TEXT NOT NULL DEFAULT 'DHF',
    "loan_account_prefix" TEXT,
    "property_account_prefix" TEXT DEFAULT '',
    "rotary_account_prefix" TEXT DEFAULT '',
    "asset_account_prefix" TEXT,
    "cash_account_prefix" TEXT,
    "current_assets_account_prefix" TEXT,
    "expense_account_prefix" TEXT,
    "income_account_prefix" TEXT,
    "equity_retained_earnings_account_prefix" TEXT,
    "equity_does_not_close_prefix" TEXT,
    "inventory_account_prefix" TEXT,
    "other_asset_account_prefix" TEXT,
    "cost_of_sales_account_prefix" TEXT,
    "fixed_asset_account_prefix" TEXT,
    "other_current_asset_account_prefix" TEXT,
    "accounts_payable_account_prefix" TEXT,
    "accounts_receivable_account_prefix" TEXT,
    "accumulated_depreciation_account_prefix" TEXT,
    "liabilities_account_prefix" TEXT,
    "other_current_liabilities_account_prefix" TEXT,
    "long_term_liabilities_account_prefix" TEXT,
    "equity_account_prefix" TEXT,
    "default_sms_charge_account" DOUBLE PRECISION,
    "default_asset_account" DOUBLE PRECISION,
    "default_cash_account" DOUBLE PRECISION,
    "default_current_assets_account" DOUBLE PRECISION,
    "default_expense_account" DOUBLE PRECISION,
    "default_income_account" DOUBLE PRECISION,
    "default_equity_retained_earnings_account" DOUBLE PRECISION,
    "default_equity_does_not_close_account" DOUBLE PRECISION,
    "default_inventory_account" DOUBLE PRECISION,
    "default_other_asset_account" DOUBLE PRECISION,
    "default_cost_of_sales_account" DOUBLE PRECISION,
    "default_fixed_asset_account" DOUBLE PRECISION,
    "default_other_current_asset_account" DOUBLE PRECISION,
    "default_accounts_payable_account" DOUBLE PRECISION,
    "default_accounts_receivable_account" DOUBLE PRECISION,
    "default_accumulated_depreciation_account" DOUBLE PRECISION,
    "default_liabilities_account" DOUBLE PRECISION,
    "default_other_current_liabilities_account" DOUBLE PRECISION,
    "default_long_term_liabilities_account" DOUBLE PRECISION,
    "default_equity_account" DOUBLE PRECISION,
    "default_tax_account" DOUBLE PRECISION,
    "default_excess_account" DOUBLE PRECISION,
    "default_allocation_account" DOUBLE PRECISION DEFAULT 0,
    "default_property_account" DOUBLE PRECISION DEFAULT 0,
    "default_rotary_account" DOUBLE PRECISION DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Organisationsettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rejecttransactiondate" (
    "id" SERIAL NOT NULL,
    "rejectiondate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,

    CONSTRAINT "Rejecttransactiondate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registrationpoint" (
    "id" SERIAL NOT NULL,
    "registrationpoint" TEXT NOT NULL,
    "description" TEXT,
    "branch" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "datecreated" TIMESTAMP(3),
    "createdby" INTEGER NOT NULL,

    CONSTRAINT "Registrationpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL,
    "assignedto" TEXT,
    "branch" TEXT NOT NULL,
    "startdate" TIMESTAMP(3) NOT NULL,
    "enddate" TIMESTAMP(3) NOT NULL,
    "taskstatus" TEXT NOT NULL DEFAULT 'NOT STARTED',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdby" INTEGER NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtask" (
    "id" SERIAL NOT NULL,
    "task" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startdate" TIMESTAMP(3) NOT NULL,
    "enddate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "taskstatus" TEXT NOT NULL DEFAULT 'NOT STARTED',
    "createdby" TEXT NOT NULL,
    "assignedto" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cashierlimit" (
    "id" SERIAL NOT NULL,
    "cashier" INTEGER NOT NULL,
    "depositlimit" DOUBLE PRECISION NOT NULL,
    "withdrawallimit" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL,
    "createdby" INTEGER NOT NULL,

    CONSTRAINT "Cashierlimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lastseen" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Lastseen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" SERIAL NOT NULL,
    "itemid" INTEGER NOT NULL,
    "itemname" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "branch" INTEGER NOT NULL,
    "units" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "pricetwo" DOUBLE PRECISION,
    "beginbalance" DOUBLE PRECISION,
    "qty" DOUBLE PRECISION,
    "minimumbalance" DOUBLE PRECISION,
    "group" TEXT,
    "applyto" TEXT NOT NULL,
    "itemclass" TEXT NOT NULL,
    "composite" TEXT NOT NULL,
    "compositeid" INTEGER,
    "description" TEXT,
    "imageone" TEXT,
    "imagetwo" TEXT,
    "imagethree" TEXT,
    "sellingprice" DOUBLE PRECISION,
    "reference" TEXT,
    "transactiondate" TEXT,
    "transactiondesc" TEXT,
    "transactionref" TEXT DEFAULT '',
    "reorderlevel" TEXT DEFAULT '2',
    "issue" TEXT,
    "issuetype" TEXT,
    "supplier" TEXT,
    "staff" TEXT DEFAULT '',
    "returned" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL,
    "createdby" INTEGER NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue" (
    "id" SERIAL NOT NULL,
    "issuetype" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL,
    "createdby" INTEGER NOT NULL,

    CONSTRAINT "issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "supplier" TEXT NOT NULL,
    "contactperson" TEXT NOT NULL,
    "contactpersonphone" TEXT NOT NULL,
    "officeaddress" TEXT,
    "nationality" TEXT NOT NULL,
    "currency" TEXT DEFAULT 'NGN',
    "state" TEXT NOT NULL,
    "bank1" TEXT,
    "accountnumber1" TEXT,
    "bank2" TEXT,
    "accountnumber2" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL,
    "createdby" INTEGER NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savingsproduct" (
    "activationfee" DOUBLE PRECISION,
    "allowdeposit" BOOLEAN NOT NULL,
    "allowoverdrawn" BOOLEAN NOT NULL,
    "allowwithdrawal" BOOLEAN NOT NULL,
    "chargehere" BOOLEAN NOT NULL DEFAULT false,
    "addmember" TEXT NOT NULL DEFAULT 'NO',
    "compulsorydeposit" BOOLEAN NOT NULL,
    "compulsorydepositdeficit" BOOLEAN NOT NULL DEFAULT false,
    "compulsorydepositfrequency" TEXT,
    "compulsorydepositfrequencyamount" DOUBLE PRECISION,
    "compulsorydepositfrequencyskip" INTEGER,
    "compulsorydepositpenalty" DOUBLE PRECISION,
    "compulsorydepositpenaltyfallbackfrom" TEXT,
    "compulsorydepositpenaltyfrom" TEXT,
    "compulsorydepositpenaltytype" TEXT,
    "compulsorydepositspillover" BOOLEAN NOT NULL,
    "compulsorydeposittype" TEXT,
    "currency" TEXT NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "depositcharge" DOUBLE PRECISION,
    "depositechargetype" TEXT DEFAULT 'PERCENTAGE',
    "eligibilityaccountage" INTEGER,
    "eligibilityminbalance" DOUBLE PRECISION,
    "eligibilitymincredit" DOUBLE PRECISION,
    "eligibilitymindebit" DOUBLE PRECISION,
    "eligibilityminimumclosedaccounts" INTEGER,
    "eligibilityminimumloan" DOUBLE PRECISION,
    "eligibilityproduct" INTEGER DEFAULT 0,
    "eligibilityproductcategory" TEXT,
    "id" SERIAL NOT NULL,
    "maxbalance" DOUBLE PRECISION,
    "membership" TEXT DEFAULT '',
    "minimumaccountbalance" DOUBLE PRECISION,
    "productname" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "updatedat" TIMESTAMP(3),
    "useraccount" INTEGER DEFAULT 1,
    "withdrawalcharges" DOUBLE PRECISION,
    "withdrawalchargeinterval" TEXT,
    "withdrawalchargetype" TEXT,
    "withdrawalcontrol" BOOLEAN DEFAULT false,
    "withdrawalcontrolamount" DOUBLE PRECISION DEFAULT 0,
    "withdrawalcontrolsize" TEXT,
    "withdrawalcontroltype" TEXT,
    "withdrawalcontrolwindow" TEXT,
    "withdrawallimit" DOUBLE PRECISION,
    "withdrawallimittype" TEXT,

    CONSTRAINT "savingsproduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interest" (
    "id" SERIAL NOT NULL,
    "savingsproductid" INTEGER NOT NULL,
    "interestname" TEXT NOT NULL,
    "interestmethod" TEXT NOT NULL,
    "interesteligibilityaccountage" INTEGER NOT NULL DEFAULT 0,
    "interesteligibilitybalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestamount" DOUBLE PRECISION NOT NULL,
    "interesttype" TEXT NOT NULL,
    "interestfrequency" TEXT NOT NULL,
    "interestfrequencynumber" INTEGER,
    "interestfrequencyskip" INTEGER,
    "interestgoforapproval" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frequencyoverride" (
    "id" SERIAL NOT NULL,
    "savingsproductid" INTEGER NOT NULL,
    "compulsorydepositfrequency" TEXT NOT NULL,
    "branch" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "frequencyoverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deduction" (
    "id" SERIAL NOT NULL,
    "savingsproductid" INTEGER NOT NULL,
    "deductionname" TEXT NOT NULL,
    "deductioneligibilityaccountage" INTEGER NOT NULL DEFAULT 0,
    "deductioneligibilitybalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductionamount" DOUBLE PRECISION NOT NULL,
    "deductiontype" TEXT NOT NULL,
    "deductionmethod" TEXT NOT NULL,
    "deductionfrequency" TEXT NOT NULL,
    "deductionfrequencynumber" INTEGER,
    "deductionfrequencyskip" INTEGER,
    "deductiongoforapproval" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Deduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings" (
    "id" SERIAL NOT NULL,
    "savingsproductid" INTEGER NOT NULL,
    "accountnumber" INTEGER NOT NULL,
    "userid" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "member" INTEGER DEFAULT 0,
    "branch" INTEGER NOT NULL,
    "registrationpoint" INTEGER,
    "registrationcharge" DOUBLE PRECISION NOT NULL,
    "registrationdate" TIMESTAMP(3) NOT NULL,
    "registrationdesc" TEXT,
    "bankname1" TEXT,
    "bankaccountname1" TEXT,
    "bankaccountnumber1" INTEGER,
    "bankname2" TEXT,
    "bankaccountname2" TEXT,
    "bankaccountnumber2" TEXT,
    "accountofficer" TEXT,
    "sms" BOOLEAN,
    "whatsapp" BOOLEAN,
    "email" BOOLEAN,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL,
    "createdby" INTEGER NOT NULL,
    "reason" TEXT DEFAULT '',

    CONSTRAINT "savings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" SERIAL NOT NULL,
    "accountnumber" TEXT NOT NULL,
    "userid" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "image" TEXT,
    "branch" INTEGER,
    "registrationpoint" INTEGER,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedby" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "updateddated" TIMESTAMP(3),
    "transactiondate" TIMESTAMP(3),
    "transactiondesc" TEXT,
    "transactionref" TEXT DEFAULT '',
    "cashref" TEXT DEFAULT '',
    "updatedby" INTEGER,
    "ttype" TEXT,
    "tfrom" TEXT,
    "createdby" INTEGER NOT NULL DEFAULT 0,
    "valuedate" TIMESTAMP(3),
    "reference" TEXT,
    "whichaccount" TEXT,
    "voucher" TEXT DEFAULT '',
    "tax" BOOLEAN DEFAULT false,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listofbanks" (
    "id" SERIAL NOT NULL,
    "bank" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "listofbanks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reciepients" (
    "id" SERIAL NOT NULL,
    "fullname" TEXT NOT NULL,
    "bank" INTEGER NOT NULL,
    "accountnumber" TEXT NOT NULL,
    "createdby" INTEGER NOT NULL DEFAULT 0,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "reciepients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banktransaction" (
    "id" SERIAL NOT NULL,
    "accountnumber" TEXT NOT NULL,
    "userid" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "debit" INTEGER,
    "credit" INTEGER,
    "ttype" TEXT,
    "tfrom" TEXT,
    "createdby" INTEGER NOT NULL DEFAULT 0,
    "valuedate" TIMESTAMP(3),
    "reference" TEXT,
    "transactiondate" TIMESTAMP(3),
    "transactiondesc" TEXT,
    "transactionref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "whichaccount" TEXT,
    "rawdata" TEXT,

    CONSTRAINT "banktransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accounts" (
    "id" SERIAL NOT NULL,
    "accountnumber" TEXT NOT NULL,
    "groupname" TEXT,
    "accounttype" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,

    CONSTRAINT "Accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loanfee" (
    "id" SERIAL NOT NULL,
    "feename" TEXT NOT NULL,
    "feemethod" TEXT NOT NULL,
    "chargesbasedon" TEXT NOT NULL,
    "chargeamount" DOUBLE PRECISION,
    "chargetype" TEXT,
    "glaccount" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL,
    "createdby" INTEGER NOT NULL,

    CONSTRAINT "loanfee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loanproduct" (
    "id" SERIAL NOT NULL,
    "productname" TEXT NOT NULL,
    "description" TEXT,
    "registrationcharge" DOUBLE PRECISION,
    "repaymentsettings" TEXT NOT NULL,
    "repaymentfrequency" TEXT,
    "numberofrepayments" INTEGER,
    "duration" INTEGER,
    "durationcategory" TEXT,
    "interestmethod" TEXT NOT NULL,
    "interestrate" DOUBLE PRECISION NOT NULL,
    "interestratetype" TEXT,
    "defaultpenaltyid" INTEGER,
    "seperateinterest" BOOLEAN DEFAULT false,
    "useraccount" INTEGER DEFAULT 1,
    "eligibilityproductcategory" TEXT,
    "eligibilityproduct" INTEGER DEFAULT 0,
    "eligibilityaccountage" INTEGER,
    "eligibilityminbalance" DOUBLE PRECISION,
    "eligibilitymincredit" DOUBLE PRECISION,
    "eligibilitymindebit" DOUBLE PRECISION,
    "eligibilityminimumloan" DOUBLE PRECISION,
    "eligibilityminimumclosedaccounts" INTEGER,
    "eligibilitytype" TEXT,
    "maximumloan" DOUBLE PRECISION,
    "minimumloan" DOUBLE PRECISION,
    "membership" TEXT DEFAULT '',
    "currency" TEXT,
    "excludebranch" TEXT,
    "productofficer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "member" INTEGER DEFAULT 0,
    "dateadded" TIMESTAMP(3) NOT NULL,
    "createdby" INTEGER NOT NULL,

    CONSTRAINT "loanproduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loanaccounts" (
    "id" SERIAL NOT NULL,
    "loanproduct" INTEGER DEFAULT 0,
    "accountnumber" TEXT,
    "userid" INTEGER NOT NULL,
    "branch" INTEGER NOT NULL,
    "registrationpoint" INTEGER,
    "registrationcharge" DOUBLE PRECISION,
    "registrationdate" TIMESTAMP(3) NOT NULL,
    "registrationdesc" TEXT,
    "loanamount" DOUBLE PRECISION NOT NULL,
    "bankname1" TEXT,
    "bankaccountname1" TEXT,
    "bankaccountnumber1" TEXT,
    "bankname2" TEXT,
    "bankaccountname2" TEXT,
    "bankaccountnumber2" TEXT,
    "accountofficer" TEXT,
    "repaymentfrequency" TEXT,
    "numberofrepayments" INTEGER,
    "duration" INTEGER,
    "durationcategory" TEXT,
    "interestmethod" TEXT NOT NULL,
    "interestrate" DOUBLE PRECISION NOT NULL,
    "interestratetype" TEXT,
    "defaultpenaltyid" INTEGER,
    "seperateinterest" BOOLEAN DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL,
    "dateclosed" TIMESTAMP(3),
    "closeamount" DOUBLE PRECISION,
    "createdby" INTEGER NOT NULL,
    "member" INTEGER DEFAULT 0,
    "disbursementref" TEXT DEFAULT '',
    "disbursementdate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loanaccounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loanpaymentschedule" (
    "id" SERIAL NOT NULL,
    "accountnumber" INTEGER NOT NULL,
    "scheduledpaymentdate" TIMESTAMP(3) NOT NULL,
    "gracepaymentdate" TIMESTAMP(3),
    "scheduleamount" DOUBLE PRECISION NOT NULL,
    "interestamount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdby" INTEGER NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,

    CONSTRAINT "loanpaymentschedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collateral" (
    "id" SERIAL NOT NULL,
    "accountnumber" INTEGER NOT NULL,
    "documenttitle" TEXT NOT NULL,
    "documentnumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "docposition" TEXT NOT NULL DEFAULT 'ISSUED',
    "documentexpiration" TIMESTAMP(3),
    "worth" DOUBLE PRECISION NOT NULL,
    "file1" TEXT,
    "file2" TEXT,
    "file3" TEXT,
    "file4" TEXT,
    "file5" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "collateral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" SERIAL NOT NULL,
    "serviceid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier" INTEGER NOT NULL,
    "staff" INTEGER,
    "servicetype" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "otherdetails" TEXT DEFAULT '',
    "amount" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'NGN',
    "amountfrom" DOUBLE PRECISION,
    "amountto" DOUBLE PRECISION,
    "servicestartdate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "serviceenddate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "branch" INTEGER NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "issue" TEXT,
    "reference" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "otp" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" SERIAL NOT NULL,
    "itemid" INTEGER NOT NULL,
    "itemname" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "branch" INTEGER NOT NULL,
    "units" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "pricetwo" DOUBLE PRECISION,
    "beginbalance" DOUBLE PRECISION,
    "qty" DOUBLE PRECISION,
    "minimumbalance" DOUBLE PRECISION,
    "group" TEXT,
    "applyto" TEXT NOT NULL,
    "itemclass" TEXT NOT NULL,
    "composite" TEXT NOT NULL,
    "compositeid" INTEGER,
    "description" TEXT,
    "imageone" TEXT,
    "imagetwo" TEXT,
    "imagethree" TEXT,
    "sellingprice" DOUBLE PRECISION,
    "reference" TEXT,
    "transactiondate" TEXT,
    "transactiondesc" TEXT,
    "transactionref" TEXT DEFAULT '',
    "reorderlevel" TEXT DEFAULT '2',
    "issue" TEXT,
    "issuetype" TEXT,
    "supplier" TEXT,
    "staff" TEXT DEFAULT '',
    "returned" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL,
    "createdby" INTEGER NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compositedetails" (
    "id" SERIAL NOT NULL,
    "compositeid" INTEGER NOT NULL,
    "itemid" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "createdby" INTEGER NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "compositedetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorytimeline" (
    "id" SERIAL NOT NULL,
    "valuefrom" INTEGER NOT NULL,
    "valueto" INTEGER NOT NULL,
    "numberofdays" INTEGER NOT NULL,
    "createdby" INTEGER NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "categorytimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propertyproduct" (
    "id" SERIAL NOT NULL,
    "product" TEXT NOT NULL,
    "member" TEXT,
    "useraccount" INTEGER NOT NULL DEFAULT 1,
    "registrationcharge" TEXT,
    "createdby" INTEGER NOT NULL,
    "description" TEXT DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "productofficer" INTEGER,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "propertyproduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propertyaccount" (
    "id" SERIAL NOT NULL,
    "productid" INTEGER NOT NULL,
    "accountnumber" TEXT NOT NULL,
    "userid" INTEGER NOT NULL,
    "membershipid" INTEGER,
    "registrationcharge" INTEGER NOT NULL,
    "registrationdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrationpoint" TEXT,
    "accountofficer" INTEGER,
    "repaymentfrequency" TEXT,
    "numberofrepayments" INTEGER,
    "percentagedelivery" INTEGER,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "propertyaccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propertyitems" (
    "id" SERIAL NOT NULL,
    "accountnumber" TEXT NOT NULL,
    "itemid" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "userid" INTEGER NOT NULL,
    "delivered" TEXT NOT NULL DEFAULT 'NO',
    "deliverystatus" TEXT NOT NULL DEFAULT 'NOT STARTED',
    "deliveryrequested" TEXT NOT NULL DEFAULT 'NO',
    "deliveryrequestdate" TIMESTAMP(3),
    "readyfordelivery" TEXT NOT NULL DEFAULT 'NO',
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "propertyitems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propertyinstallments" (
    "id" SERIAL NOT NULL,
    "accountnumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duedate" TIMESTAMP(3) NOT NULL,
    "delivered" TEXT NOT NULL DEFAULT 'NO',
    "userid" INTEGER NOT NULL,
    "transactionref" TEXT DEFAULT '',
    "description" TEXT DEFAULT '',
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "propertyinstallments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotaryProduct" (
    "id" SERIAL NOT NULL,
    "product" TEXT NOT NULL,
    "member" TEXT,
    "useraccount" INTEGER NOT NULL DEFAULT 1,
    "registrationcharge" TEXT,
    "createdby" INTEGER NOT NULL,
    "description" TEXT DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "productofficer" INTEGER,
    "poolnumber" TEXT NOT NULL,
    "rotaryschedule" TEXT DEFAULT 'PRODUCT',
    "frequency" TEXT,
    "frequencynumber" INTEGER,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "rotaryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotaryaccount" (
    "id" SERIAL NOT NULL,
    "accountnumber" TEXT NOT NULL,
    "userid" INTEGER NOT NULL DEFAULT 0,
    "branch" INTEGER NOT NULL DEFAULT 0,
    "registrationcharge" DOUBLE PRECISION DEFAULT 0,
    "registrationdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrationpoint" INTEGER DEFAULT 0,
    "registrationdesc" TEXT DEFAULT '',
    "member" INTEGER NOT NULL DEFAULT 0,
    "productid" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT,
    "frequencynumber" INTEGER,
    "autorunnew" TEXT NOT NULL DEFAULT 'YES',
    "createdby" INTEGER NOT NULL DEFAULT 0,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateupdated" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "takeout" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "rotaryaccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotaryschedule" (
    "id" SERIAL NOT NULL,
    "accountnumber" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "duedate" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentschedule" TEXT NOT NULL DEFAULT 'true',
    "createdby" INTEGER NOT NULL,
    "payout" TEXT NOT NULL DEFAULT 'NO',
    "payoutref" TEXT DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "rotaryschedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level" (
    "id" SERIAL NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT,
    "basicsalary" DOUBLE PRECISION,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowances" (
    "id" SERIAL NOT NULL,
    "level" INTEGER NOT NULL,
    "allowance" DOUBLE PRECISION NOT NULL,
    "allowancetype" TEXT NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "allowances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deductions" (
    "id" SERIAL NOT NULL,
    "level" INTEGER NOT NULL,
    "deduction" DOUBLE PRECISION NOT NULL,
    "deductiontype" TEXT NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guarantor" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "guarantorname" TEXT NOT NULL,
    "guarantorofficeaddress" TEXT NOT NULL,
    "guarantorresidentialaddress" TEXT NOT NULL,
    "guarantoroccupation" TEXT NOT NULL,
    "guarantorphone" TEXT NOT NULL,
    "imageone" TEXT,
    "imagetwo" TEXT,
    "yearsknown" INTEGER NOT NULL,
    "createdby" INTEGER NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "guarantor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employmentrecord" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "employer" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "years" INTEGER NOT NULL,
    "reasonofleaving" TEXT NOT NULL,
    "doc" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "employmentrecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referee" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "refereename" TEXT NOT NULL,
    "refereeofficeaddress" TEXT NOT NULL,
    "refereeresidentialaddress" TEXT NOT NULL,
    "refereeoccupation" TEXT NOT NULL,
    "refereephone" TEXT NOT NULL,
    "refereeyearsknown" INTEGER NOT NULL,
    "relationship" TEXT NOT NULL,
    "imageone" TEXT,
    "imagetwo" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "referee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualification" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "institution" TEXT NOT NULL,
    "certificationdate" TIMESTAMP(3) NOT NULL,
    "imageone" TEXT,
    "imagetwo" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualification" TEXT NOT NULL,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parentguardians" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "parentonename" TEXT NOT NULL,
    "parentoneoccupation" TEXT NOT NULL,
    "parentonestate" TEXT NOT NULL,
    "parentoneofficeaddress" TEXT NOT NULL,
    "parentonephone" TEXT NOT NULL,
    "parenttwoname" TEXT NOT NULL,
    "parenttwooccupation" TEXT NOT NULL,
    "parenttwoofficeaddress" TEXT NOT NULL,
    "parenttwostate" TEXT NOT NULL,
    "parenttwophone" TEXT NOT NULL,
    "parentoneimage" TEXT,
    "parenttwoimage" TEXT,
    "homeaddress" TEXT NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "parentguardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "query" TEXT NOT NULL,
    "imageone" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotiondemotion" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "promotiondemotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminationresignation" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "image" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "terminationresignation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspension" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "suspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startdate" TIMESTAMP(3) NOT NULL,
    "enddate" TIMESTAMP(3) NOT NULL,
    "image" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "leave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warning" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "warning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoringevaluation" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdby" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "monitoringevaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Roles_role_key" ON "Roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "DefineMember_member_key" ON "DefineMember"("member");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessiontoken_key" ON "Session"("sessiontoken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_branch_key" ON "Branch"("branch");

-- CreateIndex
CREATE UNIQUE INDEX "issue_issuetype_key" ON "issue"("issuetype");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_supplier_key" ON "Supplier"("supplier");

-- CreateIndex
CREATE UNIQUE INDEX "listofbanks_bank_key" ON "listofbanks"("bank");

-- CreateIndex
CREATE UNIQUE INDEX "loanfee_feename_key" ON "loanfee"("feename");

-- CreateIndex
CREATE UNIQUE INDEX "loanproduct_productname_key" ON "loanproduct"("productname");

-- CreateIndex
CREATE UNIQUE INDEX "propertyproduct_product_key" ON "propertyproduct"("product");

-- CreateIndex
CREATE UNIQUE INDEX "rotaryProduct_product_key" ON "rotaryProduct"("product");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userid_fkey" FOREIGN KEY ("userid") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userid_fkey" FOREIGN KEY ("userid") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_savingsproductid_fkey" FOREIGN KEY ("savingsproductid") REFERENCES "savingsproduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_savingsproductid_fkey" FOREIGN KEY ("savingsproductid") REFERENCES "savingsproduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
