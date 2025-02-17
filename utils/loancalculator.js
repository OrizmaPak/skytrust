const { StatusCodes } = require("http-status-codes");

function calculateInterest(loanAmount, interestRate, numberOfRepayments, method = 'FLAT_RATE') {
    /**
     * Basic assumptions:
     *   1. `loanAmount`: principal.
     *   2. `interestRate`: periodic interest rate, in percent. 
     *      (e.g., if you're making monthly payments at a 12% annual rate, 
     *       you'd pass in 1 for 1% per month, or convert accordingly.)
     *   3. `numberOfRepayments`: total count of installments.
     *
     * Common formulas:
     *   - FLAT_RATE: total interest = P * r * n
     *   - ONE_OF_INTEREST: total interest = P * r (once for the entire term)
     *   - INTEREST_ONLY: total interest = P * r * n
     *   - REDUCING_BALANCE: sum interest on decreasing balance
     *   - EQUAL_INSTALLMENTS (simple approach): total interest = P * r * n 
     *        (though a true “equal installments” loan often uses an EMI formula)
     *   - FIXED_RATE: typically means the rate won't change; still P * r * n is common
     */
  
    let interest = 0;
    const p = parseFloat(loanAmount);
    const r = parseFloat(interestRate) / 100; // convert % to decimal
  
    switch (method) {
      case 'NO_INTEREST':
        // No interest at all
        interest = 0;
        break;
  
      case 'FLAT_RATE':
        // Common formula: interest = P * r * n
        interest = p * r * numberOfRepayments;
        break;
  
      case 'ONE_OF_INTEREST':
        // All interest paid once, typically at end
        // If your rate is for the entire term: interest = P * r
        // (If the rate is per period, do P * r * n instead.)
        interest = p * r;
        break;
  
      case 'EQUAL_INSTALLMENTS':
        // Often uses an EMI formula to get total interest, but if you need a simple approach:
        interest = p * r * numberOfRepayments;
        break;
  
      case 'INTEREST_ONLY':
        // Pay only interest each period on the full principal, total = P * r * n
        interest = p * r * numberOfRepayments;
        break;
  
      case 'REDUCING_BALANCE':
        // Each period, interest = (remaining principal) * r
        // If principal is paid in equal chunks: chunk = P/n
        // So we sum up interest each period on the leftover principal.
        interest = 0;
        for (let i = 0; i < numberOfRepayments; i++) {
          const remaining = p - (p * i / numberOfRepayments);
          interest += remaining * r;
        }
        break;
  
      case 'BALLOON_LOAN':
        // Often interest-only for (n-1) periods + a final balloon. 
        // For simplicity, let’s do total = P * r * n
        // (If your “0.5 factor” was a special rule, adapt as needed.)
        interest = p * r * numberOfRepayments;
        break;
  
      case 'FIXED_RATE':
        // Typically means the interest rate is "fixed" over the term.
        // We can do the same approach: P * r * n
        // (If you intended it to be a flat amount per period ignoring principal, adjust accordingly.)
        interest = p * r * numberOfRepayments;
        break;
  
      // All other listed methods can behave similarly to FLAT_RATE or a simple approach:
      case 'UNSECURE_LOAN':
      case 'INSTALLMENT_LOAN':
      case 'PAYDAY_LOAN':
      case 'MICRO_LOAN':
      case 'BRIDGE_LOAN':
      case 'AGRICULTURAL_LOAN':
      case 'EDUCATION_LOAN':
      case 'WORKIN_CAPITAL':
        // Same logic: total interest = P * r * n
        interest = p * r * numberOfRepayments;
        break;
  
      default:
        throw new Error(`Invalid interest method: ${method}`);
    }
  
    // Round the result to two decimals
    interest = parseFloat(interest.toFixed(2));
    console.log(`Method: ${method}, Interest: ${interest}`);
    return interest;
  }
  

    // Start of Selection
function generateRepaymentSchedule(loanAmount, interestRate, numberOfRepayments, interestMethod, startDate, seperateInterest, repaymentDates, interest) {
    console.log('Generating repayment schedule with the following parameters:', {
        loanAmount,
        interestRate,
        numberOfRepayments,
        interestMethod,
        startDate,
        seperateInterest,
        repaymentDates,
        interest
    });

    console.log('seperateInterest:', seperateInterest);

    let repaymentAmounts = [];

    console.log('interestMethod note:', interestMethod);

    switch (interestMethod) {
        case 'NO_INTEREST':
            console.log('Interest Method: NO_INTEREST');
            for (let i = 0; i < numberOfRepayments; i++) {
                const principal = loanAmount / numberOfRepayments;
                console.log(`Repayment ${i + 1}: Principal = ${principal}, Interest = 0`);
                repaymentAmounts.push({
                    principal: principal,
                    interest: 0
                });
            }
            break;
        case 'ONE_OF_INTEREST':
        case 'INTEREST_ONLY':
        case 'BALLOON_LOAN':
            console.log(`Interest Method: ${interestMethod}`);
            const halfPrincipal = loanAmount / 2;
            const equalPrincipal = halfPrincipal / (numberOfRepayments - 1);
            for (let i = 0; i < numberOfRepayments; i++) {
                const principal = i === numberOfRepayments - 1 ? halfPrincipal : equalPrincipal;
                const interestShare = interest / numberOfRepayments;
                console.log(`Repayment ${i + 1}: Principal = ${principal}, Interest = ${interestShare}`);
                repaymentAmounts.push({
                    principal: principal,
                    interest: interestShare
                });
            }
            break;
        case 'EQUAL_INSTALLMENTS':
        case 'FLAT_RATE':
        case 'FIXED_RATE':
        case 'UNSECURE_LOAN':
        case 'INSTALLMENT_LOAN':
        case 'PAYDAY_LOAN':
        case 'MICRO_LOAN':
        case 'BRIDGE_LOAN':
        case 'AGRICULTURAL_LOAN':
        case 'EDUCATION_LOAN':
        case 'WORKIN_CAPITAL':
            console.log(`Interest Method: ${interestMethod}`);
            const totalAmount = parseFloat(loanAmount) + parseFloat(interest);
            const installmentAmount = totalAmount / numberOfRepayments;
            console.log(`Total Amount: ${totalAmount}, Installment Amount: ${installmentAmount}`);
            for (let i = 0; i < numberOfRepayments; i++) {
                const principal = !seperateInterest ? parseFloat((loanAmount / numberOfRepayments).toFixed(2)) : parseFloat(installmentAmount.toFixed(2));
                const interestPortion = !seperateInterest ? parseFloat((interest / numberOfRepayments).toFixed(2)) : 0;
                console.log(`Repayment ${i + 1}: Principal = ${principal}, Interest = ${interestPortion}`);
                repaymentAmounts.push({
                    principal: principal,
                    interest: interestPortion
                });
            }
            break;
        case 'REDUCING_BALANCE':
            console.log('Interest Method: REDUCING_BALANCE');
            let remainingLoan = parseFloat(loanAmount);
            for (let i = 0; i < numberOfRepayments; i++) {
                const principal = parseFloat((loanAmount / numberOfRepayments).toFixed(2));
                const interestPayment = parseFloat((remainingLoan * (interestRate / 100)).toFixed(2));
                console.log(`Repayment ${i + 1}: Principal = ${principal}, Remaining Loan = ${remainingLoan}, Interest = ${interestPayment}`);
                repaymentAmounts.push({
                    principal: principal,
                    interest: interestPayment
                });
                remainingLoan -= principal;
            }
            break;
        default:
            console.error(`Invalid interest method: ${interestMethod}`);
            throw new Error('Invalid interest method');
    }

    if (seperateInterest) {
        const totalInterest = repaymentAmounts.reduce((acc, curr) => acc + curr.interest, 0);
        console.log(`Total Interest to be separated: ${totalInterest}`);
        // Set all interest amounts to 0
        repaymentAmounts = repaymentAmounts.map(payment => ({
            principal: payment.principal,
            interest: 0
        }));
        // Create a separate interest payment
        const interestPayment = {
            principal: 0,
            interest: parseFloat(totalInterest.toFixed(2))
        };
        repaymentAmounts.unshift(interestPayment);
        console.log('Added separate interest payment:', interestPayment);
        // Adjust repaymentDates by adding the first date for the interest payment
        repaymentDates.unshift(repaymentDates[0]);
    }

    const repaymentSchedule = repaymentDates.map((date, index) => {
        const schedule = {
            scheduledPaymentDate: date,
            principalAmount: parseFloat(repaymentAmounts[index].principal),
            interestAmount: parseFloat(repaymentAmounts[index].interest),
            status: 'PENDING'
        };
        console.log(`Scheduled Payment ${index + 1}:`, schedule);
        return schedule;
    });

    console.log('Final Repayment Schedule:', repaymentSchedule);
    return repaymentSchedule;
}


/**
 * Generates a repayment schedule for a given loan.
 *
 * @param {number|string} loanAmount           - Principal amount of the loan.
 * @param {number|string} interestRate         - Interest rate (%).
 * @param {number|string} numberOfRepayments   - Total number of installments.
 * @param {string} interestMethod             - One of the defined loan methods.
 * @param {Date|string} startDate             - Start date of the loan.
 * @param {boolean} separateInterest          - If true, moves total interest into a separate payment.
 * @param {string} interestRateType           - Either 'INSTALLMENT' or 'PRINCIPAL'.
 * @param {string[]} repaymentDates           - Array of dates for the installments.
 * @returns {object[]}                        - Array of repayment objects with date, principal, interest, status.
 *
 * @throws {Error}                            - Throws error for invalid inputs or unsupported configurations.
 */
function generateRefinedRepaymentSchedule(
    loanAmount,
    interestRate,
    numberOfRepayments,
    interestMethod,
    startDate,
    separateInterest,
    interestRateType,
    repaymentDates,
    res
  ) {
    // Convert inputs to appropriate types
    const principal = parseFloat(loanAmount);
    const rateDecimal = parseFloat(interestRate) / 100;
    const totalPeriods = parseInt(numberOfRepayments, 10);
  
    // Input Validations
    const errors = [];

    const validationErrors = [];

    if (isNaN(principal) || principal <= 0) {
      validationErrors.push({
        field: 'loanAmount',
        message: 'Invalid loanAmount. It must be a positive number.'
      });
    }

    if (isNaN(rateDecimal) || rateDecimal < 0) {
      validationErrors.push({
        field: 'interestRate',
        message: 'Invalid interestRate. It must be a non-negative number.'
      });
    }

    if (isNaN(totalPeriods) || totalPeriods <= 0 || !Number.isInteger(totalPeriods)) {
      validationErrors.push({
        field: 'numberOfRepayments',
        message: 'Invalid numberOfRepayments. It must be a positive integer.'
      });
    }

    if (!['INSTALLMENT', 'PRINCIPAL'].includes(interestRateType)) {
      validationErrors.push({
        field: 'interestRateType',
        message: 'Invalid interestRateType. Must be "INSTALLMENT" or "PRINCIPAL".'
      });
    }

    const reducingBalanceMethods = [
      'REDUCING_BALANCE',
      'EQUAL_INSTALLMENTS',
      'FIXED_RATE',
      'UNSECURE_LOAN',
      'INSTALLMENT_LOAN',
      'AGRICULTURAL_LOAN',
      'EDUCATION_LOAN',
    ];

    if (
      reducingBalanceMethods.includes(interestMethod) &&
      interestRateType !== 'INSTALLMENT'
    ) {
      validationErrors.push({
        message: `Invalid interestRateType for ${interestMethod}. Must be "INSTALLMENT".`
      });
    }

    // const expectedDatesLength = separateInterest ? totalPeriods + 1 : totalPeriods;
    // if (repaymentDates.length < expectedDatesLength) {
    //   validationErrors.push({
    //     message: `Insufficient repaymentDates. Expected at least ${expectedDatesLength} dates.`
    //   });  
    // }

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors.map(error => error.message).join(', ');
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: `Validation Errors: ${errorMessages}`,
        errors: validationErrors
      });
    }
    // Helper Functions
    /**
     * Calculates the Equated Monthly Installment (EMI) for amortized loans.
     *
     * @param {number} principal           - Principal amount.
     * @param {number} ratePerPeriod      - Interest rate per period (decimal).
     * @param {number} totalPeriods       - Total number of installments.
     * @returns {number}                   - Calculated EMI.
     */
    function calculateEMI(principal, ratePerPeriod, totalPeriods) {
      if (ratePerPeriod === 0) {
        return principal / totalPeriods;
      }
      const numerator = principal * ratePerPeriod;
      const denominator = 1 - Math.pow(1 + ratePerPeriod, -totalPeriods);
      return numerator / denominator;
    }
  
    /**
     * Calculates flat rate repayments based on interest rate type.
     *
     * @param {number} principal           - Principal amount.
     * @param {number} rateDecimal        - Interest rate (decimal).
     * @param {number} totalPeriods       - Total number of installments.
     * @param {string} rateType           - 'INSTALLMENT' or 'PRINCIPAL'.
     * @returns {object[]}                - Array of repayment objects with principal and interest.
     */
    function calculateFlatRateRepayments(principal, rateDecimal, totalPeriods, rateType) {
      let totalInterest;
      if (rateType === 'INSTALLMENT') {
        totalInterest = principal * rateDecimal * totalPeriods;
      } else if (rateType === 'PRINCIPAL') {
        totalInterest = principal * rateDecimal;
      }
  
      const principalPerInstallment = parseFloat((principal / totalPeriods).toFixed(2));
      const interestPerInstallment = parseFloat((totalInterest / totalPeriods).toFixed(2));
  
      const repayments = [];
      for (let i = 0; i < totalPeriods; i++) {
        repayments.push({
          principal: principalPerInstallment,
          interest: interestPerInstallment,
        });
      }
      return repayments;
    }
  
    /**
     * Adjusts the last installment to account for rounding discrepancies.
     *
     * @param {object[]} repayments        - Array of repayment objects.
     * @param {number} principal           - Principal amount.
     * @returns {object[]}                  - Adjusted repayments with the last installment corrected.
     */
    function adjustLastInstallment(repayments, principal) {
      const sumPrincipal = repayments.reduce((sum, repayment) => sum + repayment.principal, 0);
      const difference = parseFloat((principal - sumPrincipal).toFixed(2));
  
      if (difference !== 0) {
        repayments[repayments.length - 1].principal += difference;
        repayments[repayments.length - 1].principal = parseFloat(
          repayments[repayments.length - 1].principal.toFixed(2)
        );
      }
  
      return repayments;
    }
  
    // Initialize repaymentAmounts array
    let repaymentAmounts = [];
  
    // Main Logic: Calculate repayment amounts based on interestMethod and interestRateType
    switch (interestMethod) {
      //------------------------------------------------------------------------------
      case 'NO_INTEREST': {
        // No interest; divide principal equally
        const principalPerInstallment = parseFloat((principal / totalPeriods).toFixed(2));
        for (let i = 0; i < totalPeriods; i++) {
          repaymentAmounts.push({
            principal: principalPerInstallment,
            interest: 0,
          });
        }
        repaymentAmounts = adjustLastInstallment(repaymentAmounts, principal);
        break;
      }
      //------------------------------------------------------------------------------
      case 'FLAT_RATE':
      case 'PAYDAY_LOAN':
      case 'MICRO_LOAN': {
        // Flat rate interest calculation
        repaymentAmounts = calculateFlatRateRepayments(
          principal,
          rateDecimal,
          totalPeriods,
          interestRateType
        );
        break;
      }
      //------------------------------------------------------------------------------
      case 'ONE_OF_INTEREST': {
        // All interest is paid in the final installment
        let totalInterest;
        if (interestRateType === 'INSTALLMENT') {
          totalInterest = principal * rateDecimal * totalPeriods;
        } else if (interestRateType === 'PRINCIPAL') {
          totalInterest = principal * rateDecimal;
        }
  
        const principalPerInstallment = parseFloat((principal / totalPeriods).toFixed(2));
  
        for (let i = 0; i < totalPeriods; i++) {
          if (i < totalPeriods - 1) {
            repaymentAmounts.push({
              principal: principalPerInstallment,
              interest: 0,
            });
          } else {
            // Last installment: principal + totalInterest
            const sumPrincipal = principalPerInstallment * (totalPeriods - 1);
            const lastPrincipal = parseFloat((principal - sumPrincipal).toFixed(2));
            repaymentAmounts.push({
              principal: lastPrincipal,
              interest: parseFloat(totalInterest.toFixed(2)),
            });
          }
        }
        break;
      }
      //------------------------------------------------------------------------------
      case 'INTEREST_ONLY': {
        // Interest-only payments until final installment, which includes principal
        let totalInterest;
        if (interestRateType === 'INSTALLMENT') {
          totalInterest = principal * rateDecimal * totalPeriods;
        } else if (interestRateType === 'PRINCIPAL') {
          totalInterest = principal * rateDecimal;
        }
  
        let interestPerInstallment;
        if (interestRateType === 'INSTALLMENT') {
          interestPerInstallment = parseFloat((principal * rateDecimal).toFixed(2));
        } else {
          interestPerInstallment = parseFloat((totalInterest / totalPeriods).toFixed(2));
        }
  
        for (let i = 0; i < totalPeriods; i++) {
          if (i < totalPeriods - 1) {
            repaymentAmounts.push({
              principal: 0,
              interest: interestPerInstallment,
            });
          } else {
            // Final installment: principal + interest
            repaymentAmounts.push({
              principal: principal,
              interest: interestPerInstallment,
            });
          }
        }
        break;
      }
      //------------------------------------------------------------------------------
      case 'EQUAL_INSTALLMENTS':
      case 'FIXED_RATE':
      case 'UNSECURE_LOAN':
      case 'INSTALLMENT_LOAN':
      case 'AGRICULTURAL_LOAN':
      case 'EDUCATION_LOAN': {
        if (interestRateType === 'PRINCIPAL') {
          // Treat as flat rate since amortization doesn't apply with one-time interest
          repaymentAmounts = calculateFlatRateRepayments(
            principal,
            rateDecimal,
            totalPeriods,
            'PRINCIPAL'
          );
        } else if (interestRateType === 'INSTALLMENT') {
          // Standard amortized (EMI) loan
          let EMI = calculateEMI(principal, rateDecimal, totalPeriods);
          EMI = parseFloat(EMI.toFixed(2));
  
          let remainingPrincipal = principal;
  
          for (let i = 0; i < totalPeriods; i++) {
            const interestForPeriod = parseFloat((remainingPrincipal * rateDecimal).toFixed(2));
            let principalForPeriod = parseFloat((EMI - interestForPeriod).toFixed(2));
  
            if (i === totalPeriods - 1) {
              // Adjust the last installment to account for rounding
              principalForPeriod = parseFloat(remainingPrincipal.toFixed(2));
            }
  
            repaymentAmounts.push({
              principal: principalForPeriod,
              interest: interestForPeriod,
            });
  
            remainingPrincipal -= principalForPeriod;
          }
  
          repaymentAmounts = adjustLastInstallment(repaymentAmounts, principal);
        }
        break;
      }
      //------------------------------------------------------------------------------
      case 'REDUCING_BALANCE': {
        // REDUCING_BALANCE inherently uses 'INSTALLMENT' type; interest based on remaining principal
        const principalPerInstallment = parseFloat((principal / totalPeriods).toFixed(2));
        let remainingPrincipal = principal;
  
        for (let i = 0; i < totalPeriods; i++) {
          const interestForPeriod = parseFloat((remainingPrincipal * rateDecimal).toFixed(2));
          let thisPrincipal = principalPerInstallment;
  
          if (i === totalPeriods - 1) {
            // Adjust the last installment to account for rounding
            thisPrincipal = parseFloat(remainingPrincipal.toFixed(2));
          }
  
          repaymentAmounts.push({
            principal: thisPrincipal,
            interest: interestForPeriod,
          });
  
          remainingPrincipal -= thisPrincipal;
        }
        break;
      }
      //------------------------------------------------------------------------------
      case 'BALLOON_LOAN':
      case 'BRIDGE_LOAN': {
        // Interest-only payments until the final installment, which includes principal
        let totalInterest;
        if (interestRateType === 'INSTALLMENT') {
          totalInterest = principal * rateDecimal * totalPeriods;
        } else if (interestRateType === 'PRINCIPAL') {
          totalInterest = principal * rateDecimal;
        }
  
        let interestPerInstallment;
        if (interestRateType === 'INSTALLMENT') {
          interestPerInstallment = parseFloat((principal * rateDecimal).toFixed(2));
        } else {
          interestPerInstallment = parseFloat((totalInterest / totalPeriods).toFixed(2));
        }
  
        for (let i = 0; i < totalPeriods; i++) {
          if (i < totalPeriods - 1) {
            // Interest-only payment
            repaymentAmounts.push({
              principal: 0,
              interest: interestPerInstallment,
            });
          } else {
            // Final installment: principal + interest
            const finalInterest =
              interestRateType === 'PRINCIPAL'
                ? parseFloat((principal * rateDecimal).toFixed(2))
                : interestPerInstallment;
  
            repaymentAmounts.push({
              principal: principal,
              interest: finalInterest,
            });
          }
        }
        break;
      }
      //------------------------------------------------------------------------------
      case 'WORKIN_CAPITAL': {
        // Similar to BALLOON_LOAN and BRIDGE_LOAN
        let totalInterest;
        if (interestRateType === 'INSTALLMENT') {
          totalInterest = principal * rateDecimal * totalPeriods;
        } else if (interestRateType === 'PRINCIPAL') {
          totalInterest = principal * rateDecimal;
        }
  
        let interestPerInstallment;
        if (interestRateType === 'INSTALLMENT') {
          interestPerInstallment = parseFloat((principal * rateDecimal).toFixed(2));
        } else {
          interestPerInstallment = parseFloat((totalInterest / totalPeriods).toFixed(2));
        }
  
        for (let i = 0; i < totalPeriods; i++) {
          if (i < totalPeriods - 1) {
            // Interest-only payment
            repaymentAmounts.push({
              principal: 0,
              interest: interestPerInstallment,
            });
          } else {
            // Final installment: principal + interest
            const finalInterest =
              interestRateType === 'PRINCIPAL'
                ? parseFloat((principal * rateDecimal).toFixed(2))
                : interestPerInstallment;
  
            repaymentAmounts.push({
              principal: principal,
              interest: finalInterest,
            });
          }
        }
        break;
      }
      //------------------------------------------------------------------------------
      default: {
        console.warn(`Unknown method: ${interestMethod}. Using FLAT_RATE fallback.`);
        // Flat rate fallback based on interestRateType
        repaymentAmounts = calculateFlatRateRepayments(
          principal,
          rateDecimal,
          totalPeriods,
          interestRateType
        );
        break;
      }
    }
  
    //------------------------------------------------------------------------------
    // Handle the "separateInterest" logic if requested.
    // This lumps all interest into a single, separate entry.
    // By default, we put that at the *beginning* of the schedule. 
    // (If you prefer at the end, you can push instead of unshift.)
    if (separateInterest) {
      const totalInterest = repaymentAmounts.reduce(
        (acc, cur) => acc + cur.interest,
        0
      );
      // Zero out the interest in each installment
      repaymentAmounts = repaymentAmounts.map((item) => ({
        principal: item.principal,
        interest: 0,
      }));
      // Create a separate payment for that total interest
      const separateIntPayment = {
        principal: 0,
        interest: parseFloat(totalInterest.toFixed(2)),
      };
      repaymentAmounts.unshift(separateIntPayment);
  
      // Also shift the dates so the first date is for interest
      if (repaymentDates && repaymentDates.length > 0) {
        repaymentDates.unshift(repaymentDates[0]);
      }
    }
  
    //------------------------------------------------------------------------------
    // Adjust the repaymentAmounts for any rounding discrepancies
    // (Optional: Already handled in specific methods if needed)
  
    //------------------------------------------------------------------------------
    // Finally, build the schedule array with dates and status
    const repaymentSchedule = repaymentAmounts.map((payItem, idx) => {
      const date = repaymentDates && repaymentDates[idx] ? repaymentDates[idx] : null;
      return {
        scheduledPaymentDate: date,
        principalAmount: parseFloat(payItem.principal.toFixed(2)),
        interestAmount: parseFloat(payItem.interest.toFixed(2)),
        status: 'PENDING',
      };
    });
  
    // Optional: Validate that the total principal and interest match expected totals
    const totalPrincipal = repaymentSchedule.reduce(
      (sum, payment) => sum + payment.principalAmount,
      0
    );
    const totalInterestPaid = repaymentSchedule.reduce(
      (sum, payment) => sum + payment.interestAmount,
      0
    );
  
    // Verify total principal
    if (parseFloat(totalPrincipal.toFixed(2)) !== parseFloat(principal.toFixed(2))) {
      console.warn(
        `Total principal mismatch: Expected ${principal.toFixed(
          2
        )}, but got ${totalPrincipal.toFixed(2)}.`
      );
    }
  
    // Verify total interest
    let expectedTotalInterest;
    switch (interestMethod) {
      case 'NO_INTEREST':
        expectedTotalInterest = 0;
        break;
      case 'FLAT_RATE':
      case 'PAYDAY_LOAN':
      case 'MICRO_LOAN':
      case 'ONE_OF_INTEREST':
      case 'INTEREST_ONLY':
      case 'BALLOON_LOAN':
      case 'BRIDGE_LOAN':
      case 'WORKIN_CAPITAL':
        if (interestRateType === 'INSTALLMENT') {
          expectedTotalInterest = principal * rateDecimal * totalPeriods;
        } else {
          expectedTotalInterest = principal * rateDecimal;
        }
        break;
      case 'EQUAL_INSTALLMENTS':
      case 'FIXED_RATE':
      case 'UNSECURE_LOAN':
      case 'INSTALLMENT_LOAN':
      case 'AGRICULTURAL_LOAN':
      case 'EDUCATION_LOAN':
        if (interestRateType === 'INSTALLMENT') {
          // Total interest is the sum of all interest payments
          expectedTotalInterest = repaymentSchedule.reduce(
            (sum, payment) => sum + payment.interestAmount,
            0
          );
        } else {
          expectedTotalInterest = principal * rateDecimal;
        }
        break;
      case 'REDUCING_BALANCE':
        expectedTotalInterest = repaymentSchedule.reduce(
          (sum, payment) => sum + payment.interestAmount,
          0
        );
        break;
      default:
        expectedTotalInterest = principal * rateDecimal * totalPeriods;
    }
  
    if (
      parseFloat(totalInterestPaid.toFixed(2)) !==
      parseFloat(expectedTotalInterest.toFixed(2))
    ) {
      console.warn(
        `Total interest mismatch: Expected ${expectedTotalInterest.toFixed(
          2
        )}, but got ${totalInterestPaid.toFixed(2)}.`
      );
    }
  
    console.log('Final Repayment Schedule:', repaymentSchedule);
    return repaymentSchedule;
  }
  
  
  
  

module.exports = { calculateInterest, generateRepaymentSchedule, generateRefinedRepaymentSchedule };
