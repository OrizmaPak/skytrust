const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteSavingsAccountTransactionHistory = async (req, res) => {
  const user = req.user;
  const id = req.params.id || req.body?.id || req.query.id;

  if (!id) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: false,
      message: "Savings account id is required",
      statuscode: StatusCodes.BAD_REQUEST,
      data: null,
      errors: ["Savings account id is required"]
    });
  }

  try {
    const result = await pg.withTransaction(async (client) => {
      const accountResult = await client.query(
        `SELECT id, accountnumber FROM skytobi."savings" WHERE id = $1`,
        [id]
      );

      if (accountResult.rows.length === 0) {
        return { notFound: true };
      }

      const accountNumber = String(accountResult.rows[0].accountnumber);
      const deletedTransactions = await client.query(
        `DELETE FROM skytobi."transaction" WHERE accountnumber::text = $1`,
        [accountNumber]
      );

      return {
        notFound: false,
        accountNumber,
        deletedTransactions: deletedTransactions.rowCount
      };
    });

    if (result.notFound) {
      await activityMiddleware(req, user.id, "Savings account not found for transaction history deletion", "ACCOUNT");
      return res.status(StatusCodes.NOT_FOUND).json({
        status: false,
        message: "Savings account not found",
        statuscode: StatusCodes.NOT_FOUND,
        data: null,
        errors: []
      });
    }

    await activityMiddleware(
      req,
      user.id,
      `Deleted ${result.deletedTransactions} transactions for savings account ${result.accountNumber}`,
      "TRANSACTION"
    );

    return res.status(StatusCodes.OK).json({
      status: true,
      message: result.deletedTransactions > 0
        ? `Transaction history deleted successfully for account ${result.accountNumber}.`
        : `No transaction history found for account ${result.accountNumber}.`,
      statuscode: StatusCodes.OK,
      data: {
        accountnumber: result.accountNumber,
        deletedtransactions: result.deletedTransactions
      },
      errors: []
    });
  } catch (error) {
    console.error("Unexpected Error:", error);
    await activityMiddleware(req, user.id, "An unexpected error occurred deleting savings account transaction history", "ACCOUNT");
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "An unexpected error occurred",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [error.message]
    });
  }
};

module.exports = { deleteSavingsAccountTransactionHistory };
