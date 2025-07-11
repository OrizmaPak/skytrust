const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { validateCode } = require("../../../utils/datecode");

// Function to manage loan product creation and update
const manageLoanProduct = async (req, res) => {
    // Destructure request body to get loan product details
    let { id, productname, description, interestmethod, interestrate=0, interestratetype, repaymentsettings, repaymentfrequency, numberofrepayments, duration, durationcategory, currency, excludebranch, productofficer, defaultpenaltyid, registrationcharge, status = 'ACTIVE', dateadded = new Date(), eligibilityproductcategory, eligibilityproduct, eligibilityaccountage, eligibilityminbalance, eligibilitytype, maximumloan, minimumloan, eligibilityminimumloan, eligibilityminimumclosedaccounts, membership, seperateinterest } = req.body;
    
    // Get user information from request
    const user = req.user;
    
    seperateinterest = seperateinterest ? true : false;
    console.log('entered controller') 
    
    // Initialize an array to store validation errors
    const errors = [];
     
    // Validate product name
    if (!productname) {
        errors.push({
            field: 'productname',  
            message: 'Product name not found'  
        });
    } else if (typeof productname !== 'string' || productname.trim() === '') {
        errors.push({
            field: 'productname',
            message: 'Product name must be a non-empty string'
        });  
    }
    
    // Validate interest method
    if (!interestmethod) {
        errors.push({
            field: 'interestmethod',
            message: 'Interest method not found'
        });
    } else if (typeof interestmethod !== 'string' || !['NO INTEREST', 'FLAT RATE', 'ONE OF INTEREST', 'INTEREST ONLY', 'EQUAL INSTALLMENTS', 'REDUCING BALANCE', 'BALLOON LOAN', 'FIXED RATE', 'UNSECURE LOAN', 'INSTALLMENT LOAN', 'PAYDAY LOAN', 'MICRO LOAN', 'BRIDGE LOAN', 'AGRICULTURAL LOAN', 'EDUCATION LOAN', 'WORKIN CAPITAL'].includes(interestmethod)) {
        errors.push({
            field: 'interestmethod',
            message: 'Interest method must be one of "NO INTEREST", "FLAT RATE", "ONE OF INTEREST", "INTEREST ONLY", "EQUAL INSTALLMENTS", "REDUCING BALANCE", "BALLOON LOAN", "FIXED RATE", "UNSECURE LOAN", "INSTALLMENT LOAN", "PAYDAY LOAN", "MICRO LOAN", "BRIDGE LOAN", "AGRICULTURAL LOAN", "EDUCATION LOAN", or "WORKIN CAPITAL"'
        });
    }
    
    // Validate interest rate
    if (!interestrate && interestmethod !== 'NO INTEREST') {
        errors.push({
            field: 'interestrate',
            message: 'Interest rate not found'
        });
    } 
    
    // Validate interest rate type
    if (interestratetype && !['INSTALLMENT', 'PRINCIPAL'].includes(interestratetype)) {
        errors.push({
            field: 'interestratetype',
            message: 'Interest rate type must be one of "INSTALLMENT" or "PRINCIPAL"'
        });
    }
    
    // Validate repayment settings
    if (!repaymentsettings) {
        errors.push({
            field: 'repaymentsettings',
            message: 'Repayment settings not found'
        });
    } else if (typeof repaymentsettings !== 'string' || !['ACCOUNT', 'PRODUCT'].includes(repaymentsettings)) {
        errors.push({
            field: 'repaymentsettings',
            message: 'Repayment settings must be one of "ACCOUNT" or "PRODUCT"'
        });
    }

    // Validate product officer if provided
    if (productofficer !== undefined && productofficer !== '' && isNaN(parseInt(productofficer, 10))) {
        errors.push({
            field: 'productofficer',
            message: 'Product officer must be an integer'
        });
    } 
    
    // Validate repayment frequency if provided
    if (repaymentfrequency && !validateCode(repaymentfrequency)) {
        errors.push({
            field: 'repaymentfrequency',
            message: 'Repayment frequency is invalid'
        });
    }
    console.log('entered controller')
    
    // Validate number of repayments if provided
    // if (numberofrepayments !== undefined && numberofrepayments == '') {
    //     errors.push({
    //         field: 'numberofrepayments',
    //         message: 'Number of repayments not found'
    //     });
    // } else if (numberofrepayments && isNaN(parseInt(numberofrepayments, 10)) || parseInt(numberofrepayments, 10) <= 0) {
    //     errors.push({
    //         field: 'numberofrepayments',
    //         message: 'Number of repayments must be a positive number'
    //     });
    // }
    
    // Validate duration if provided
    // if (duration !== undefined && duration !== '') {
    //     const parsedDuration = parseInt(duration, 10);
    //     if (isNaN(parsedDuration) || parsedDuration <= 0) {
    //         errors.push({
    //             field: 'duration',
    //             message: 'Duration must be a positive number'
    //         });
    //     }
    // }

    // Validate excludebranch if provided
    if (excludebranch !== undefined && excludebranch !== '') {
        if (typeof excludebranch !== 'string') {
            errors.push({
                field: 'excludebranch',
                message: 'Exclude branch must be a string'
            });
        } else {
            const branchIds = excludebranch.split(',');
            for (const branchId of branchIds) {
                if (isNaN(parseInt(branchId.trim(), 10))) {
                    errors.push({
                        field: 'excludebranch',
                        message: `Branch ID ${branchId} must be a number`
                    });
                } else {
                    const branchQuery = {
                        text: 'SELECT * FROM skyeu."Branch" WHERE id = $1',
                        values: [parseInt(branchId.trim(), 10)]
                    };
                    const { rows: branchRows } = await pg.query(branchQuery);
                    if (branchRows.length === 0) {
                        errors.push({
                            field: 'excludebranch',
                            message: `Branch ID ${branchId} not found in the Branch table`
                        });
                    }
                }
            }
        }
    }

    // Validate eligibility conditions
    if (eligibilityproductcategory) {
        if (!['LOAN', 'SAVINGS'].includes(eligibilityproductcategory)) {
            errors.push({
                field: 'eligibilityproductcategory',
                message: 'Eligibility product category must be one of "LOAN" or "SAVINGS"'
            });
        } else {
            if (eligibilityproductcategory === 'SAVINGS' && (!eligibilityproduct || eligibilityproduct <= 0)) {
                errors.push({
                    field: 'eligibilityproduct',
                    message: 'Eligibility product must be greater than zero for savings category'
                });
            }

            if (eligibilityproductcategory === 'SAVINGS' && eligibilityproduct > 0) {
                const savingsProductQuery = {
                    text: 'SELECT * FROM skyeu."savingsproduct" WHERE id = $1',
                    values: [eligibilityproduct]
                };
                const { rows: savingsProductRows } = await pg.query(savingsProductQuery);

                if (savingsProductRows.length === 0) {
                    errors.push({
                        field: 'eligibilityproduct',
                        message: 'Eligibility product not found in the savings product table'
                    });
                } 
            }

            if (eligibilityproductcategory === 'LOAN' && eligibilityproduct > 0) {
                const loanProductQuery = {
                    text: 'SELECT * FROM skyeu."loanproduct" WHERE id = $1',
                    values: [eligibilityproduct]
                };
                const { rows: loanProductRows } = await pg.query(loanProductQuery);

                if (loanProductRows.length === 0) {
                    errors.push({
                        field: 'eligibilityproduct',
                        message: 'Eligibility product not found in the loan product table'
                    });
                }
            }
        }
    }

    // Validate eligibility type and loan amounts
    if (eligibilitytype) {
        if (!['PERCENTAGE', 'AMOUNT'].includes(eligibilitytype)) {
            errors.push({
                field: 'eligibilitytype',
                message: 'Eligibility type must be one of "PERCENTAGE" or "AMOUNT"'
            });
        } else {
            if (eligibilitytype === 'AMOUNT') {
                if (!maximumloan || maximumloan <= 0) {
                    errors.push({
                        field: 'maximumloan',
                        message: 'Maximum loan amount must be provided and greater than zero for amount eligibility type'
                    });
                }
                if (!minimumloan || minimumloan <= 0) {
                    errors.push({
                        field: 'minimumloan',
                        message: 'Minimum loan amount must be provided and greater than zero for amount eligibility type'
                    });
                }
            } else if (eligibilitytype === 'PERCENTAGE') {
                if (!minimumloan || minimumloan <= 0) {
                    errors.push({
                        field: 'minimumloan',
                        message: 'Minimum loan amount must be provided and greater than zero for percentage eligibility type'
                    });
                }
            }
        }
    }

    // Validate membership if provided
    if (membership !== undefined && membership !== '') {
        if (typeof membership !== 'string') {
            errors.push({
                field: 'membership',
                message: 'Membership must be a string'
            });
        }
    }

    // If there are validation errors, return a bad request response
    if (errors.length > 0) {
        console.log('Validation errors:', errors);
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Validation Errors",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: errors
        });
    }

    // Check if the product name already exists if the id is not sent
    if (!id) {
        const productNameQuery = {
            text: 'SELECT * FROM skyeu."loanproduct" WHERE productname = $1',
            values: [productname]
        };
        const { rows: productNameRows } = await pg.query(productNameQuery);

        if (productNameRows.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Product name already exists',
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }
    }

    try {
        console.log('Checking if product name is unique');
        // Check if the product name is unique
        const productNameQuery = {
            text: 'SELECT * FROM skyeu."loanproduct" WHERE productname = $1',
            values: [productname]
        };
        const { rows: productNameRows } = await pg.query(productNameQuery);

        // If product name is not unique, return a bad request response
        if (productNameRows.length > 0 && (!id || productNameRows[0].id != id)) {
            console.log('Product name is not unique');
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: 'Product name must be unique',
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        console.log('Checking if default penalty ID exists');
        // Check if the default penalty ID exists in the loanfee table
        if (defaultpenaltyid) {
            const penaltyQuery = {
                text: 'SELECT * FROM skyeu."loanfee" WHERE id = $1 AND feemethod = $2',
                values: [defaultpenaltyid, 'PENALTY']
            };
            const { rows: penaltyRows } = await pg.query(penaltyQuery);

            // If default penalty ID is invalid, return a bad request response
            if (penaltyRows.length === 0) {
                console.log('Invalid default penalty ID');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: 'Invalid default penalty ID provided',
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }

        // console.log('Checking if product officer exists');
        // // Check if the product officer exists in the user table
        if (productofficer) {
            const productOfficerQuery = {
                text: 'SELECT * FROM skyeu."User" WHERE id = $1',
                values: [productofficer]
            };
            const { rows: productOfficerRows } = await pg.query(productOfficerQuery);

            // If product officer ID is invalid, return a bad request response
            if (productOfficerRows.length === 0) {
                console.log('Invalid product officer ID');
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: 'Invalid product officer ID provided',
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }

        let loanProduct;
        if (id) {
            console.log('Updating existing loan product'); 
            // Update existing loan product
            const updateLoanProductQuery = {
                text: `UPDATE skyeu."loanproduct" SET 
                        productname = COALESCE($1, productname), 
                        description = COALESCE($2, description), 
                        interestmethod = COALESCE($3, interestmethod), 
                        interestrate = COALESCE($4, interestrate), 
                        interestratetype = COALESCE($5, interestratetype),
                        repaymentsettings = COALESCE($6, repaymentsettings), 
                        repaymentfrequency = COALESCE($7, repaymentfrequency), 
                        numberofrepayments = COALESCE($8, numberofrepayments), 
                        duration = COALESCE($9, duration), 
                        durationcategory = COALESCE($10, durationcategory), 
                        currency = COALESCE($11, currency), 
                        excludebranch = COALESCE($12, excludebranch), 
                        productofficer = COALESCE($13, productofficer), 
                        defaultpenaltyid = COALESCE($14, defaultpenaltyid), 
                        registrationcharge = COALESCE($15, registrationcharge),
                        status = COALESCE($16, 'PENDING APPROVAL'),
                        eligibilityproductcategory = COALESCE($17, eligibilityproductcategory),
                        eligibilityproduct = COALESCE($18, eligibilityproduct),
                        eligibilityaccountage = COALESCE($19, eligibilityaccountage),
                        eligibilityminbalance = COALESCE($20, eligibilityminbalance),
                        eligibilitytype = COALESCE($21, eligibilitytype),
                        maximumloan = COALESCE($22, maximumloan),
                        minimumloan = COALESCE($23, minimumloan),
                        eligibilityminimumloan = COALESCE($24, eligibilityminimumloan),
                        eligibilityminimumclosedaccounts = COALESCE($25, eligibilityminimumclosedaccounts),
                        membership = COALESCE($26, membership),
                        seperateinterest = COALESCE($27, seperateinterest)
                       WHERE id = $28 RETURNING *`,
                values: [productname, description, interestmethod, interestrate, interestratetype, repaymentsettings, repaymentfrequency, numberofrepayments, duration, durationcategory, currency, excludebranch, productofficer, defaultpenaltyid, registrationcharge, "PENDING APPROVAL", eligibilityproductcategory, eligibilityproduct, eligibilityaccountage == "" ? 0 : eligibilityaccountage, eligibilityminbalance == "" ? 0 : eligibilityminbalance, eligibilitytype, maximumloan == "" ? 0 : maximumloan, minimumloan == "" ? 0 : minimumloan, eligibilityminimumloan == "" ? 0 : eligibilityminimumloan, eligibilityminimumclosedaccounts == "" ? 0 : eligibilityminimumclosedaccounts, membership, seperateinterest, id]
            };
            const { rows: updatedLoanProductRows } = await pg.query(updateLoanProductQuery);
            loanProduct = updatedLoanProductRows[0];
        } else {
            console.log('Creating new loan product', numberofrepayments??0);
            // Create new loan product
            const createLoanProductQuery = {
                text: `INSERT INTO skyeu."loanproduct" (
                        productname, 
                        description, 
                        interestmethod, 
                        interestrate, 
                        interestratetype,
                        repaymentsettings, 
                        repaymentfrequency, 
                        numberofrepayments, 
                        duration, 
                        durationcategory, 
                        currency, 
                        excludebranch, 
                        productofficer, 
                        defaultpenaltyid, 
                        registrationcharge, 
                        status, 
                        dateadded, 
                        createdby, 
                        eligibilityproductcategory, 
                        eligibilityproduct, 
                        eligibilityaccountage, 
                        eligibilityminbalance, 
                        eligibilitytype, 
                        maximumloan, 
                        minimumloan, 
                        eligibilityminimumloan, 
                        eligibilityminimumclosedaccounts,
                        membership,
                        seperateinterest
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 
                        $21, $22, $23, $24, $25, $26, $27, $28, $29
                    ) RETURNING *`,
                values: [
                    productname, 
                    description, 
                    interestmethod, 
                    interestrate == '' ? 0 : interestrate,
                    interestratetype,
                    repaymentsettings, 
                    repaymentfrequency, 
                    numberofrepayments == '' ? 0 : numberofrepayments,
                    duration == '' ? 0 : duration,
                    durationcategory, 
                    currency,  
                    excludebranch, 
                    productofficer, 
                    defaultpenaltyid == '' ? 0 : defaultpenaltyid,
                    registrationcharge, 
                    "PENDING APPROVAL", 
                    new Date(), 
                    user.id, 
                    eligibilityproductcategory, 
                    eligibilityproduct, 
                    eligibilityaccountage == '' ? 0 : eligibilityaccountage,
                    eligibilityminbalance == '' ? 0 : eligibilityminbalance,
                    eligibilitytype, 
                    maximumloan == '' ? 0 : maximumloan,
                    minimumloan == '' ? 0 : minimumloan,
                    eligibilityminimumloan == '' ? 0 : eligibilityminimumloan,
                    eligibilityminimumclosedaccounts == '' ? 0 : eligibilityminimumclosedaccounts,
                    membership,
                    seperateinterest
                ]
            };
            const { rows: createdLoanProductRows } = await pg.query(createLoanProductQuery);
            loanProduct = createdLoanProductRows[0];
        }

        console.log('Returning success response'); 
        // Return success response with loan product data
        res.status(StatusCodes.OK).json({
            status: true,
            message: id ? `Loan product ${productname} updated successfully` : `Loan product ${productname} created successfully`,
            statuscode: StatusCodes.OK,
            data: loanProduct,
            errors: []
        });
    } catch (error) {
        // Log unexpected error and return internal server error response
        console.error('Unexpected Error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: error.details??error,
            errors: []
        });
    }
};

module.exports = { manageLoanProduct };