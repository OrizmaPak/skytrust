const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

async function addOrUpdateCollateral(req, res) {
    // Destructure all potential fields, including 'id' for updates
    const {
        id,
        accountnumber,
        documenttitle,
        documentnumber,
        description,
        docposition,
        worth,
        file1,
        file2,
        file3,
        file4,
        file5,
        documentexpiration
    } = req.body;

    // Initialize an array to collect validation errors
    const errors = [];

    // Helper function to add errors
    const addError = (field, message) => {
        errors.push({ field, message });
    };

    // Validate account number
    if (!accountnumber) {
        addError('accountnumber', 'Account number is required');
    } else if (isNaN(parseInt(accountnumber))) {
        addError('accountnumber', 'Account number must be a number');
    }

    // Validate document title
    if (!documenttitle) {
        addError('documenttitle', 'Document title is required');
    } else if (typeof documenttitle !== 'string') {
        addError('documenttitle', 'Document title must be a string');
    }

    // Validate document number
    if (!documentnumber) {
        addError('documentnumber', 'Document number is required');
    } else if (typeof documentnumber !== 'string') {
        addError('documentnumber', 'Document number must be a string');
    }

    // Validate description
    if (!description) {
        addError('description', 'Description is required');
    } else if (typeof description !== 'string') {
        addError('description', 'Description must be a string');
    }

    // Validate document position
    const validDocPositions = ["ISSUED", "WITHHELD", "INVALID", "RETURNED", "DESTROYED", "LOST", "DAMAGED", "RECOVERED"];
    if (!docposition) {
        addError('docposition', 'Document position is required');
    } else if (typeof docposition !== 'string') {
        addError('docposition', 'Document position must be a string');
    } else if (!validDocPositions.includes(docposition)) {
        addError('docposition', `Document position must be one of the following: ${validDocPositions.join(', ')}`);
    }

    // Validate worth 
    if (worth === undefined || worth === '' || isNaN(parseFloat(worth))) {
        addError('worth', 'Worth must be a number');
    }

    // If there are validation errors, return a bad request response
    if (errors.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Validation Errors",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: errors
        });
    }

    try {
        if (id) {
            // **Update Operation**

            // First, check if the collateral with the given id exists
            const existingCollateralQuery = `SELECT * FROM sky."collateral" WHERE id = $1`;
            const existingCollateralResult = await pg.query(existingCollateralQuery, [id]);

            if (existingCollateralResult.rows.length === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Collateral with the provided ID does not exist",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }

            // Optional: If updating document number with docposition 'ISSUED', ensure uniqueness
            if (documentnumber || docposition) {
                const existingDocumentQuery = `
                    SELECT * FROM sky."collateral" 
                    WHERE accountnumber = $1 
                      AND documentnumber = $2 
                      AND docposition = 'ISSUED'
                      AND id <> $3
                `;
                const existingDocumentResult = await pg.query(existingDocumentQuery, [accountnumber, documentnumber, id]);

                if (existingDocumentResult.rows.length > 0) {
                    return res.status(StatusCodes.CONFLICT).json({
                        status: false,
                        message: "Document number already exists for the account number with the document position of 'ISSUED'",
                        statuscode: StatusCodes.CONFLICT,
                        data: null,
                        errors: []
                    });
                }
            }

            // Perform the update using COALESCE to retain existing values if new ones aren't provided
            const updateCollateralQuery = `
                UPDATE sky."collateral" SET
                    accountnumber = COALESCE($1, accountnumber),
                    documenttitle = COALESCE($2, documenttitle),
                    documentnumber = COALESCE($3, documentnumber),
                    description = COALESCE($4, description),
                    docposition = COALESCE($5, docposition),
                    worth = COALESCE($6, worth),
                    file1 = COALESCE($7, file1),
                    file2 = COALESCE($8, file2),
                    file3 = COALESCE($9, file3),
                    file4 = COALESCE($10, file4),
                    file5 = COALESCE($11, file5),
                    documentexpiration = COALESCE($12, documentexpiration),
                    status = 'PENDING APPROVAL',
                    dateadded = NOW(),
                    createdby = COALESCE($13, createdby)
                WHERE id = $14
                RETURNING *
            `;

            const updateValues = [
                accountnumber,
                documenttitle,
                documentnumber,
                description,
                docposition,
                worth,
                file1,
                file2,
                file3,
                file4,
                file5,
                documentexpiration,
                req.user.id,
                id
            ];

            const updatedCollateral = await pg.query(updateCollateralQuery, updateValues);

            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Collateral updated successfully",
                statuscode: StatusCodes.OK,
                data: updatedCollateral.rows[0],
                errors: []
            });

        } else {
            // **Create Operation**

            // Check if the document number already exists for the account number with the docposition of 'ISSUED'
            const existingDocumentQuery = `
                SELECT * FROM sky."collateral" 
                WHERE accountnumber = $1 AND documentnumber = $2 AND docposition = 'ISSUED'
            `;
            const existingDocumentResult = await pg.query(existingDocumentQuery, [accountnumber, documentnumber]);

            if (existingDocumentResult.rows.length > 0) {
                return res.status(StatusCodes.CONFLICT).json({
                    status: false,
                    message: "Document number already exists for the account number with the document position of 'ISSUED'",
                    statuscode: StatusCodes.CONFLICT,
                    data: null,
                    errors: []
                });
            }

            // Optional: Verify that the account number exists in the loanaccounts table
            // Uncomment if needed
            /*
            const accountCheck = await pg.query(`SELECT * FROM sky."loanaccounts" WHERE accountnumber = $1`, [accountnumber]);
            if (accountCheck.rows.length === 0) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Account number does not exist",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }
            */

            // Insert the new collateral record
            const insertCollateralQuery = `
                INSERT INTO sky."collateral" (
                    accountnumber, 
                    documenttitle, 
                    documentnumber, 
                    description, 
                    docposition, 
                    worth, 
                    file1, 
                    file2, 
                    file3, 
                    file4, 
                    file5, 
                    documentexpiration, 
                    status, 
                    dateadded, 
                    createdby
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
                    'PENDING APPROVAL', NOW(), $13
                ) RETURNING *
            `;
            const insertValues = [
                accountnumber,
                documenttitle,
                documentnumber,
                description,
                docposition,
                worth,
                file1,
                file2,
                file3,
                file4,
                file5,
                documentexpiration,
                req.user.id
            ];

            const newCollateral = await pg.query(insertCollateralQuery, insertValues);

            return res.status(StatusCodes.CREATED).json({
                status: true,
                message: "Collateral added successfully",
                statuscode: StatusCodes.CREATED,
                data: newCollateral.rows[0],
                errors: []
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}

module.exports = { addOrUpdateCollateral };
