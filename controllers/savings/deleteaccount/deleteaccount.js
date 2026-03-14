const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const deleteSavingsAccount = async (req, res) => {
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
    await pg.query("BEGIN");

    const accountResult = await pg.query(
      `SELECT * FROM skytobi."savings" WHERE id = $1`,
      [id]
    );

    if (accountResult.rows.length === 0) {
      await pg.query("ROLLBACK");
      await activityMiddleware(req, user.id, "Savings account not found for deletion", "ACCOUNT");
      return res.status(StatusCodes.NOT_FOUND).json({
        status: false,
        message: "Savings account not found",
        statuscode: StatusCodes.NOT_FOUND,
        data: null,
        errors: []
      });
    }

    const account = accountResult.rows[0];
    const accountNumber = String(account.accountnumber);

    const deletedTransactions = await pg.query(
      `DELETE FROM skytobi."transaction" WHERE accountnumber = $1`,
      [accountNumber]
    );

    const deletedAccount = await pg.query(
      `DELETE FROM skytobi."savings" WHERE id = $1 RETURNING *`,
      [id]
    );

    await pg.query("COMMIT");

    await activityMiddleware(
      req,
      user.id,
      `Savings account ${accountNumber} deleted successfully`,
      "ACCOUNT"
    );

    return res.status(StatusCodes.OK).json({
      status: true,
      message: "Savings account deleted successfully",
      statuscode: StatusCodes.OK,
      data: {
        account: deletedAccount.rows[0],
        deletedtransactions: deletedTransactions.rowCount
      },
      errors: []
    });
  } catch (error) {
    await pg.query("ROLLBACK");
    console.error("Unexpected Error:", error);
    await activityMiddleware(req, user.id, "An unexpected error occurred deleting savings account", "ACCOUNT");
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: "An unexpected error occurred",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [error.message]
    });
  }
};

module.exports = { deleteSavingsAccount };
