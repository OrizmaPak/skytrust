const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

const updateDisbursementRef = async (req, res) => {
    const { accountnumber, disbursementref } = req.body;

    // Validation: Check if accountnumber and disbursementref are provided
    if (!accountnumber || !disbursementref) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Account number and disbursement reference are required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Account number and disbursement reference are required"]
        });
    }

    try {
        // // Fetch the loan product and registration charge using the account number
        // const loanAccountQuery = {
        //     text: `SELECT loanproduct, registrationcharge FROM sky."loanaccounts" WHERE accountnumber = $1`,
        //     values: [accountnumber]
        // };
        // const loanAccountResult = await pg.query(loanAccountQuery);

        // // If no loan account found, return 404
        // if (loanAccountResult.rowCount === 0) {
        //     return res.status(StatusCodes.NOT_FOUND).json({
        //         status: false,
        //         message: "Loan account not found",
        //         statuscode: StatusCodes.NOT_FOUND,
        //         data: null,
        //         errors: ["Loan account not found"]
        //     });
        // }

        // const { loanproduct, registrationcharge } = loanAccountResult.rows[0];

        // // Fetch the administration setting for additional loan registration charge
        // const adminSettingQuery = {
        //     text: `SELECT addition_loan_registration_charge FROM sky."Organisationsettings" WHERE loanproduct = $1`,
        //     values: [loanproduct]
        // };
        // const adminSettingResult = await pg.query(adminSettingQuery);

        // if (adminSettingResult.rowCount === 0) {
        //     return res.status(StatusCodes.NOT_FOUND).json({
        //         status: false,
        //         message: "Administration setting not found for the loan product",
        //         statuscode: StatusCodes.NOT_FOUND,
        //         data: null,
        //         errors: ["Administration setting not found for the loan product"]
        //     });
        // }

        // const { addition_loan_registration_charge } = adminSettingResult.rows[0];

        // Update the disbursement reference for the given loan account
        const updateQuery = {
            text: `UPDATE sky."loanaccounts" SET disbursementref = $1, disbursementdate = NOW() WHERE accountnumber = $2`,
            values: [disbursementref, accountnumber]
        };
        await pg.query(updateQuery);

        // Successfully updated the disbursement reference
        // charge:addition_loan_registration_charge
        // {
        //     registrationcharge,
        // },
        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Disbursement reference updated successfully",
            statuscode: StatusCodes.OK,
            data: null, 
            errors: null
        });

    } catch (error) {
        console.error("Error updating disbursement reference:", error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal server error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [error.message]
        });
    }
};

module.exports = {
    updateDisbursementRef
};

