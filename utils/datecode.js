// **Prompt:**

// I have a system that uses a specific format of codes to represent intervals of time, and I need help validating these codes. The system follows these rules:

// 1. **Days (D1 to D7)**: 
//    - Represent the days of the week. 
//    - D1 is Monday, D7 is Sunday.
//    - If the day code ends with **T** (e.g., **D1T**), it refers to a specific day of the month (1st to 31st). For example, **D1T** means the 1st day of the month, and **D31T** means the 31st day of the month.
//    - Without **T**, the valid range is **D1** to **D7** (days of the week).

// 2. **Weeks (W1 to W5)**:
//    - Represent weeks of the month.
//    - **W1** is the first week, and **W5** is the fifth week (if it exists).
//    - No other week values are valid beyond **W5**.

// 3. **Months (M1, M2, M3, ...)**:
//    - Represent months in intervals.
//    - The number following **M** can be any positive integer (e.g., **M1** for every month, **M3** for every three months, etc.).

// 4. **Years (Y1, Y2, Y3, ...)**:
//    - Represent years in intervals.
//    - The number following **Y** can be any positive integer (e.g., **Y1** for every year, **Y2** for every two years, etc.).

// 5. **Day Intervals (DT1, DT10, DT15, ...)**:
//    - Represent intervals of days.
//    - The number following **DT** can be any positive integer (e.g., **DT10** for every 10 days, **DT15** for every 15 days, etc.).

// 6. **Combinations**:
//    - Allow up to 4 combinations of the above intervals.
//    - Combinations should be separated by a plus sign (+).
//    - For example, "D1 W1 M1+DT10 DT15+D1 W1 M1 Y1".

// ### Invalid Examples:
// - **D44 M1**: Invalid because the day value without **T** can only go up to **D7**.
// - **D9 M1**: Invalid because **D9** is outside the valid day range (D1 to D7).
// - **D2 W6 M3**: Invalid because weeks can only be **W1** to **W5**.
// - **D1 W1 M1 Y0**: Invalid because the year interval must be a positive integer.
// - **DT10 DT15**: Invalid because there is a repetition of code without a plus sign.

// ### Valid Examples:
// - **D1T M1**: Valid, referring to the 1st day of every month.
// - **D1 W1 M1**: Valid, referring to the Monday of the first week of every month.
// - **D3 W3 M2**: Valid, referring to Wednesday of the third week in every two months.
// - **D1T M13**: Valid, referring to the 1st day of every 13 months.
// - **D1 W1 M1 Y1**: Valid, referring to the Monday of the first week of every month, every year.
// - **D7 W5 M6 Y2**: Valid, referring to the Sunday of the fifth week (if it exists) in every six months, every two years.
// - **DT10+DT15**: Valid, referring to every 10 days and then every 15 days.
// - **D1 W1 M1+DT10+DT15+D1 W1 M1 Y1**: Valid, referring to the Monday of the first week of every month, every 10 days, and the Monday of the first week of every month, every year.


// NEW

// Time Interval Coding System: Comprehensive Rules and Guidelines
// Introduction
// This document outlines a specific format of codes used to represent intervals of time. The system is designed to encode complex scheduling patterns succinctly. Below are the detailed rules, components, examples, and validations to ensure accurate code generation and interpretation.

// 1. Code Components
// The coding system is composed of several components, each representing different aspects of time intervals. These components can be combined to form complex scheduling codes.

// A. Days (D1 to D7 and D1T to D31T)
// D1 to D7:

// Purpose: Represent the days of the week.
// Definitions:
// D1: Sunday
// D2: Monday
// D3: Tuesday
// D4: Wednesday
// D5: Thursday
// D6: Friday
// D7: Saturday
// Usage: Indicates a specific weekday.
// D1T to D31T:

// Purpose: Represent specific days of the calendar month.
// Definitions:
// D1T: 1st day of the month
// D2T: 2nd day of the month
// ...
// D31T: 31st day of the month
// Usage: Indicates a specific calendar day regardless of the weekday.
// Important Notes:

// Without the "T" suffix: Codes refer to weekdays.
// With the "T" suffix: Codes refer to specific calendar days.
// Validity:
// D1 to D7: Valid only for weekdays.
// D1T to D31T: Valid for specific days (1-31) of the month.
// B. Week Occurrences (WO1 to WO5)
// WO1 to WO5:
// Purpose: Represent the nth occurrence of a specific weekday within a month.
// Definitions:
// WO1: First occurrence (e.g., first Sunday)
// WO2: Second occurrence (e.g., second Monday)
// WO3: Third occurrence (e.g., third Tuesday)
// WO4: Fourth occurrence (e.g., fourth Wednesday)
// WO5: Fifth occurrence (e.g., fifth Thursday) (if applicable)
// Usage: Specifies the which occurrence of the specified weekday in the month.
// Important Notes:

// WO5 may not exist in all months, depending on the number of weeks.
// Week Occurrence must precede the Month Interval in the code.
// C. Months (M1, M2, M3, ...)
// M1, M2, M3, ...:
// Purpose: Represent monthly intervals.
// Definitions:
// M1: Every month
// M2: Every two months
// M3: Every three months
// ...
// Usage: Specifies the frequency of the event in terms of months.
// Important Notes:

// The number following "M" must be a positive integer (e.g., M1, M5, M12).
// D. Years (Y1, Y2, Y3, ...)
// Y1, Y2, Y3, ...:
// Purpose: Represent yearly intervals.
// Definitions:
// Y1: Every year
// Y2: Every two years
// Y3: Every three years
// ...
// Usage: Specifies the frequency of the event in terms of years.
// Important Notes:

// The number following "Y" must be a positive integer (e.g., Y1, Y5, Y10).
// E. Day Intervals (DT1, DT10, DT15, ...)
// DT1, DT10, DT15, ...:
// Purpose: Represent daily intervals.
// Definitions:
// DT1: Every day
// DT10: Every 10 days
// DT15: Every 15 days
// ...
// Usage: Specifies the frequency of the event in terms of days.
// Important Notes:

// The number following "DT" must be a positive integer (e.g., DT1, DT5, DT30).
// 2. Combination Rules
// Codes can combine multiple components to represent complex scheduling patterns. The following rules govern how components can be combined.

// A. General Combination Rules
// Maximum Combinations:

// Up to 4 combinations are allowed within a single code.
// Separation:

// Plus sign (+) is used to separate different combinations.
// Within a single combination, components are space-separated.
// Order of Components:

// Day Component (D1 to D7 or D1T to D31T) comes first.
// Week Occurrence (WO1 to WO5) comes second (if applicable).
// Month Interval (M1, M2, ...) comes third.
// Year Interval (Y1, Y2, ...) comes fourth (if applicable).
// Day Interval (DT1, DT10, ...) is separate and can be a standalone combination.
// No Repetition Within a Combination:

// A specific component (e.g., D2) cannot be repeated within the same combination.
// Repetitions must be separated by a plus sign (+).
// Self-Containment:

// Each combination must be complete and unambiguous.
// All necessary components must be present to define the interval clearly.
// B. Specific Combination Scenarios
// Combining Weekday and Week Occurrence:

// Example: D3 WO2 M4
// D3: Tuesday
// WO2: Second occurrence
// M4: Every four months
// Meaning: Every second Tuesday of every four months.
// Combining Day Intervals with Other Components:

// Example: DT10 M1 + D1 WO1 M1
// DT10 M1: Every 10 days
// D1 WO1 M1: First Sunday of every month
// Meaning: Every 10 days and the first Sunday of every month.
// Multiple Combinations:

// Example: D2 WO2 M3 + DT15 Y1
// D2 WO2 M3: Every second Monday of every three months
// DT15 Y1: Every 15 days every year
// Meaning: Every second Monday of every three months and every 15 days every year.
// 3. Validation Rules
// To ensure codes are valid and unambiguous, the following validation rules must be adhered to:

// A. Component Validity
// Days (D1 to D7):

// Must be within D1 (Sunday) to D7 (Saturday).
// Cannot exceed this range.
// Specific Days (D1T to D31T):

// Must be within D1T (1st day) to D31T (31st day).
// Cannot exceed this range.
// Week Occurrences (WO1 to WO5):

// Must be within WO1 (first occurrence) to WO5 (fifth occurrence).
// Cannot exceed this range.
// Months (M1, M2, M3, ...):

// The number following "M" must be a positive integer.
// No upper limit on the number.
// Years (Y1, Y2, Y3, ...):

// The number following "Y" must be a positive integer.
// No upper limit on the number.
// Day Intervals (DT1, DT10, DT15, ...):

// The number following "DT" must be a positive integer.
// No upper limit on the number.
// B. Combination Validity
// Maximum of 4 Combinations:

// A single code cannot contain more than 4 separate combinations.
// Separation with Plus Sign (+):

// Different combinations must be separated by a plus sign (+).
// No other separators are allowed.
// No Repetition Within a Combination:

// Duplicate components within a single combination are invalid.
// Example: D2 WO2 M3 D2 is invalid.
// Complete Combinations:

// Each combination must include all necessary components to define the interval.
// Incomplete combinations are invalid.
// Example: D2 M3 is invalid if WO2 is required for clarity.
// 4. Examples
// A. Valid Codes
// Single Combination with Week Occurrence:

// Code: D3 WO2 M4
// Meaning: Every second Tuesday of every four months.
// Multiple Combinations:

// Code: D1T M1 + DT10
// Meaning: The first day of every month and every 10 days.
// Combination with Year Interval:

// Code: D6 WO5 M6 Y2
// Meaning: Every fifth Friday of every six months, every two years.
// Multiple Standalone Combinations:

// Code: DT10 + DT15 + D1 WO1 M1 + D2 WO2 M3
// Meaning: Every 10 days, every 15 days, the first Sunday of every month, and the second Monday of every three months.
// Example for "Every Second Tuesday of Every Three Months":

// Code: D3 WO2 M3
// Meaning: Every second Tuesday of every three months.
// B. Invalid Codes
// Invalid Day Without "T":

// Code: D8 M1
// Reason: D8 exceeds the valid range (D1 to D7).
// Invalid Week Occurrence:

// Code: D2 WO6 M3
// Reason: WO6 exceeds the valid range (WO1 to WO5).
// Zero Year Interval:

// Code: D1 WO1 M1 Y0
// Reason: Y0 is not a positive integer.
// Repetition Without Plus Sign:

// Code: DT10 DT15
// Reason: Repetition of codes without separation by a plus sign.
// Incomplete Combination:

// Code: D2 M3
// Reason: Missing WO2 to specify the second occurrence.
// Week Occurrence Without Day:

// Code: WO2 M3
// Reason: WO2 lacks an associated day component (D1-D7 or D1T-D31T).
// 5. Applying the Rules
// Example 1: "Every Second Tuesday of Every Three Months"
// Code Representation:

// Copy code
// D3 WO2 M3
// Breakdown:

// D3: Tuesday
// WO2: Second occurrence of Tuesday in the month
// M3: Every three months
// Interpretation:

// The event occurs on the second Tuesday of every three months.
// Example 2: "Every Last Friday of Every Six Months"
// Code Representation:

// Copy code
// D6 WO5 M6
// Breakdown:

// D6: Friday
// WO5: Fifth occurrence of Friday in the month (if applicable)
// M6: Every six months
// Interpretation:

// The event occurs on the fifth Friday of every six months, if a fifth Friday exists in that month.
// Example 3: "Every 10 Days and the First Sunday of Every Month"
// Code Representation:

// Copy code
// DT10 + D1 WO1 M1
// Breakdown:

// DT10: Every 10 days
// D1 WO1 M1: First Sunday of every month
// Interpretation:

// The event occurs every 10 days and on the first Sunday of every month.
// Example 4: "Every Third Wednesday, Every 15 Days, and Every Fourth Thursday of Every Two Years"
// Code Representation:

// Copy code
// D4 WO4 M1 Y2 + D3 WO3 M1 Y2 + DT15
// Breakdown:

// D4 WO4 M1 Y2: Every fourth Wednesday of every year, every two years
// D3 WO3 M1 Y2: Every third Tuesday of every year, every two years
// DT15: Every 15 days
// Interpretation:

// The event occurs on the fourth Wednesday and third Tuesday of every year (every two years), and every 15 days.
// 6. Step-by-Step Guide for Code Validation
// To ensure a code is valid, follow these steps:

// Split the Code into Combinations:

// Use the plus sign (+) to separate different combinations.
// Example: D3 WO2 M4 + DT10 splits into D3 WO2 M4 and DT10.
// Validate Each Combination Individually:

// Check Component Order:
// Day (D1-D7 or D1T-D31T) → Week Occurrence (WO1-WO5, if applicable) → Month Interval (M1, M2, ...) → Year Interval (Y1, Y2, ..., if applicable).
// Verify Component Values:
// Ensure all components are within their valid ranges.
// Ensure Completeness:
// For combinations involving weekdays, ensure both Day and Week Occurrence are present.
// Check for Repetitions:

// Ensure no duplicate components exist within the same combination.
// Repeated components must be separated by a plus sign (+).
// Confirm the Number of Combinations:

// Ensure there are no more than 4 combinations.
// Final Validation:

// If all combinations pass the above checks, the code is valid.
// Otherwise, identify and rectify the specific validation errors.
// 7. Additional Considerations
// Handling WO5:

// Not all months have a fifth occurrence of a weekday.
// If WO5 is specified, ensure it exists in the targeted months.
// Combining Multiple Intervals:

// Ensure that combined intervals do not conflict or create ambiguous schedules.
// Clearly define each combination to maintain unambiguity.
// Extensibility:

// The system is designed to be flexible and extensible, allowing for future additions or modifications as needed.
// 8. Summary
// This comprehensive guide establishes a robust framework for representing complex time intervals using a standardized coding system. By adhering to the outlined rules and validation steps, users can generate accurate and unambiguous codes for various scheduling needs.

// Key Takeaways:

// Use "D" codes for specifying weekdays or specific calendar days.
// Incorporate "WO" codes to denote the occurrence of a weekday within a month.
// Define intervals using "M", "Y", and "DT" codes for months, years, and day intervals, respectively.
// Combine components thoughtfully, ensuring clarity and avoiding ambiguity through proper separation and adherence to combination rules.
// Example Code Breakdown for Clarity:

// Code: D3 WO2 M3 + DT15 Y1

// Combination 1: D3 WO2 M3

// D3: Tuesday
// WO2: Second occurrence
// M3: Every three months
// Meaning: Every second Tuesday of every three months.
// Combination 2: DT15 Y1

// DT15: Every 15 days
// Y1: Every year
// Meaning: Every 15 days annually.
// End of Comprehensive Guide


/**
 * Validates a given code based on the specified rules.
 * @param {string} code - The code to validate.
 * @returns {boolean} - Returns true if the code is valid, false otherwise.
 */
function validateCode(code) {
    if(!code) return false
    // Split the code by plus signs to get individual combinations
    const combinations = code.split('+');

    // Check if the number of combinations exceeds 4
    if (combinations.length > 14) {
        return false; // Invalid: More than 4 combinations
    }

    // Loop through each combination
    for (let combination of combinations) {
        // Trim and split the combination by spaces to get individual parts
        const parts = combination.trim().split(/\s+/);

        // Initialize flags to track component presence
        let hasDayComponent = false;
        let hasWeekOccurrence = false;
        let hasMonthInterval = false;
        let hasYearInterval = false;
        let hasDayInterval = false;

        // Loop through each part of the combination
        for (let part of parts) {
            if (part.startsWith('D')) {
                // Handle day codes
                const isT = part.endsWith('T');
                const dayNumberStr = part.substring(1, part.length - (isT ? 1 : 0));
                const dayNumber = parseInt(dayNumberStr, 10);

                // If T is present, day must be between 1 and 31
                // Else, day must be between 1 and 7
                if (
                    isNaN(dayNumber) ||
                    (isT ? dayNumber < 1 || dayNumber > 31 : dayNumber < 1 || dayNumber > 7)
                ) {
                    return false; // Invalid day
                }
                // Check for unrecognized characters
                if (part.length > (isT ? 4 : 3)) {
                    return false; // Unrecognized characters
                }
                hasDayComponent = true;
            } else if (part.startsWith('WO')) {
                // Handle week occurrence codes
                const weekNumberStr = part.substring(2);
                const weekNumber = parseInt(weekNumberStr, 10);
                if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 5) {
                    return false; // Invalid week occurrence
                }
                hasWeekOccurrence = true;
            } else if (part.startsWith('M')) {
                // Handle month codes
                const monthNumber = parseInt(part.substring(1), 10);
                if (isNaN(monthNumber) || monthNumber < 1) {
                    return false; // Invalid month
                }
                hasMonthInterval = true;
            } else if (part.startsWith('Y')) {
                // Handle year codes
                const yearNumber = parseInt(part.substring(1), 10);
                if (isNaN(yearNumber) || yearNumber < 1) {
                    return false; // Invalid year
                }
                hasYearInterval = true;
            } else if (part.startsWith('DT')) {
                // Handle day interval codes
                const dayInterval = parseInt(part.substring(2), 10);
                if (isNaN(dayInterval) || dayInterval < 1) {
                    return false; // Invalid day interval
                }
                hasDayInterval = true;
            } else {
                return false; // Unrecognized part
            }
        }

        // Validate the order of components
        if (hasWeekOccurrence && !hasDayComponent) {
            return false; // Invalid: Week occurrence without a day component
        }

        // Ensure no repetition within a combination
        const uniqueParts = new Set(parts);
        if (uniqueParts.size !== parts.length) {
            return false; // Invalid: Repetition within a combination
        }
    }

    // If all parts are valid, return true
    return true;
}

/**
 * Generates the last date, second-to-last date, and next date based on the code.
 * @param {string} code - The code specifying the intervals.
 * @returns {object} - An object containing the dates in ISO format.
 */
/* Start of Selection */
function generateDates(code) {
    // 1. Helper: nth weekday with fallback
    //    If the exact nth weekday doesn't exist, we fallback to n-1, n-2, etc., until we find one.
    function getNthWeekdayFallback(year, month, weekday, n) {
      // Try n, n-1, n-2, ... until we find a valid occurrence or return null if none
      for (let i = n; i >= 1; i--) {
        const date = computeNthWeekday(year, month, weekday, i);
        if (date) return date;
      }
      return null; // truly none found (rare)
    }
  
    // 2. Core logic to compute the nth weekday (without fallback)
    //    Returns null if that nth weekday doesn’t exist in the month.
    function computeNthWeekday(year, month, weekday, n) {
      // weekday: 0=Sunday ... 6=Saturday
      // n: 1..5
      const firstDay = new Date(year, month, 1);
      const firstWeekday = firstDay.getDay(); // 0..6
      let offset = (weekday - firstWeekday + 7) % 7;
      let day = 1 + offset + (n - 1) * 7;
      const candidate = new Date(year, month, day);
  
      // Check if it's still in the same month
      if (candidate.getMonth() !== month) {
        return null; // nth weekday doesn't exist
      }
      return candidate;
    }
  
    // 3. Helper to check if a day (e.g., 31) is valid in a given month/year
    //    If not valid, we fallback to the last day of that month.
    function clampDayToMonth(year, month, desiredDay) {
      // e.g., desiredDay=31, but April has 30 days => pick 30
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      return desiredDay > daysInMonth ? daysInMonth : desiredDay;
    }
  
    // 4. Helper to see if a date is valid (year/month/day) without fallback
    function isValidDate(year, month, day) {
      const test = new Date(year, month, day);
      return (test.getFullYear() === year &&
              test.getMonth() === month &&
              test.getDate() === day);
    }
  
    // 5. Current Date
    const now = new Date();
  
    // 6. Split code into combinations
    const combinations = code.split('+').map(c => c.trim());
  
    // 7. Prepare arrays
    const nextDates = [];
    const lastDates = [];
    const secondToLastDates = [];
  
    // 8. Parse each combination and compute next/last/second-last
    for (let combination of combinations) {
      const parts = combination.split(/\s+/);
  
      // Extract fields
      let dayInterval    = null;  // e.g. DT10
      let yearInterval   = 1;     // e.g. Y2
      let monthInterval  = 1;     // e.g. M3
      let dayCode        = null;  // e.g. D2, D31T
      let weekOccurrence = null;  // e.g. WO2
  
      for (let part of parts) {
        if (part.startsWith('DT') && /^DT\d+$/.test(part)) {
          // Day Interval
          dayInterval = parseInt(part.slice(2), 10);
        } else if (part.startsWith('Y') && /^Y\d+$/.test(part)) {
          // Year Interval
          yearInterval = parseInt(part.slice(1), 10);
        } else if (part.startsWith('M') && /^M\d+$/.test(part)) {
          // Month Interval
          monthInterval = parseInt(part.slice(1), 10);
        } else if (part.startsWith('WO') && /^WO[1-5]$/.test(part)) {
          // Week Occurrence
          weekOccurrence = parseInt(part.slice(2), 10);
        } else if (part.startsWith('D') && part.endsWith('T') && /^D\d{1,2}T$/.test(part)) {
          // Specific day of the month, e.g. D15T
          dayCode = part;
        } else if (part.startsWith('D') && /^D[1-7]$/.test(part)) {
          // Weekday D1..D7
          dayCode = part;
        } else {
          throw new Error(`Invalid code component: ${part}`);
        }
      }
  
      // --- Now compute nextDate, lastDate, secondToLastDate for this combination ---
      let nextDate    = null;
      let lastDate    = null;
      let secondToLastDate = null;
  
      // A) If dayInterval (DTx)
      if (dayInterval !== null && !dayCode) {
        // nextDate: now + dayInterval
        nextDate = new Date(now);
        nextDate.setDate(now.getDate() + dayInterval);
  
        // lastDate: now - dayInterval
        lastDate = new Date(now);
        lastDate.setDate(now.getDate() - dayInterval);
  
        // secondToLastDate: now - 2*dayInterval
        secondToLastDate = new Date(lastDate);
        secondToLastDate.setDate(secondToLastDate.getDate() - dayInterval);
      }
      // B) If we have a specific day, e.g. D31T
      else if (dayCode && dayCode.endsWith('T')) {
        // example: D15T => dayOfMonth=15
        const dayOfMonth = parseInt(dayCode.slice(1, -1), 10);
  
        // 1) NEXT DATE:
        let tYear  = now.getFullYear();
        let tMonth = now.getMonth();
  
        // Build a date in the *current month*
        let fallbackDay = clampDayToMonth(tYear, tMonth, dayOfMonth);
        let candidate   = new Date(tYear, tMonth, fallbackDay);
  
        // If candidate <= now, move forward by monthInterval
        if (candidate <= now) {
          tMonth += monthInterval;
          tYear  += Math.floor(tMonth / 12);
          tMonth  = tMonth % 12;
  
          fallbackDay = clampDayToMonth(tYear, tMonth, dayOfMonth);
          candidate   = new Date(tYear, tMonth, fallbackDay);
        }
  
        // Now apply year interval => the interpretation:
        //   "Y2" might mean skip 2 entire years, or you might do + (yearInterval - 1).
        //   For simplicity, let's do candidate.setFullYear( candidate.getFullYear() + (yearInterval - 1) );
        //   But if your logic says "Y2" => from this occurrence +2, do that.
        candidate.setFullYear(candidate.getFullYear() + (yearInterval - 1));
        nextDate = candidate;
  
        // 2) LAST DATE:
        //    "Last date" we interpret as the same rule but going backwards.
        let lYear  = tYear;
        let lMonth = tMonth;
        // step back by monthInterval
        lMonth -= monthInterval;
        while (lMonth < 0) {
          lYear -= 1;
          lMonth += 12;
        }
  
        let lastFallbackDay = clampDayToMonth(lYear, lMonth, dayOfMonth);
        let lastCandidate   = new Date(lYear, lMonth, lastFallbackDay);
  
        // Also apply yearInterval backward if you want consistent logic:
        // if (yearInterval > 1) lastCandidate.setFullYear(lastCandidate.getFullYear() - (yearInterval - 1));
        // or skip entire yearInterval:
        lYear   = lastCandidate.getFullYear() - (yearInterval - 1);
        lastCandidate.setFullYear(lYear);
        lastDate = lastCandidate;
  
        // 3) SECOND-TO-LAST DATE:
        let sYear  = lastCandidate.getFullYear();
        let sMonth = lastCandidate.getMonth();
        // step back again
        sMonth -= monthInterval;
        while (sMonth < 0) {
          sYear -= 1;
          sMonth += 12;
        }
        let sFallbackDay = clampDayToMonth(sYear, sMonth, dayOfMonth);
        let secondCandidate = new Date(sYear, sMonth, sFallbackDay);
        // yearInterval backward again
        sYear   = secondCandidate.getFullYear() - (yearInterval - 1);
        secondCandidate.setFullYear(sYear);
        secondToLastDate = secondCandidate;
      }
      // C) If we have a weekday, e.g. D2 => Monday, with or without WOx
      else if (dayCode && /^D[1-7]$/.test(dayCode)) {
        // Map D1..D7 => JS weekday 0..6
        const map = {
          D1: 0, // Sunday
          D2: 1, // Monday
          D3: 2, // Tuesday
          D4: 3, // Wednesday
          D5: 4, // Thursday
          D6: 5, // Friday
          D7: 6  // Saturday
        };
        const weekday = map[dayCode];
  
        // If no weekOccurrence => default to 1
        if (!weekOccurrence) {
          weekOccurrence = 1;
        }
  
        // 1) NEXT DATE:
        let y = now.getFullYear();
        let m = now.getMonth();
  
        // Attempt the nth weekday in the current month (with fallback)
        let candidate = getNthWeekdayFallback(y, m, weekday, weekOccurrence);
  
        // If candidate is null or <= now => jump forward by monthInterval
        if (!candidate || candidate <= now) {
          m += monthInterval;
          y += Math.floor(m / 12);
          m = m % 12;
  
          candidate = getNthWeekdayFallback(y, m, weekday, weekOccurrence);
          // If STILL null, keep going in increments of monthInterval (rare)
          while (!candidate) {
            m += monthInterval;
            y += Math.floor(m / 12);
            m = m % 12;
            candidate = getNthWeekdayFallback(y, m, weekday, weekOccurrence);
          }
        }
  
        // Apply year interval forward
        candidate.setFullYear(candidate.getFullYear() + (yearInterval - 1));
        nextDate = candidate;
  
        // 2) LAST DATE: basically the prior interval
        let lYear  = y;
        let lMonth = m - monthInterval;
        while (lMonth < 0) {
          lYear -= 1;
          lMonth += 12;
        }
        let lastCandidate = getNthWeekdayFallback(lYear, lMonth, weekday, weekOccurrence);
        // If it's truly null, we do further fallback (rare)
        while (!lastCandidate) {
          lMonth -= monthInterval;
          while (lMonth < 0) {
            lYear -= 1;
            lMonth += 12;
          }
          lastCandidate = getNthWeekdayFallback(lYear, lMonth, weekday, weekOccurrence);
        }
        // Apply year interval backward
        lastCandidate.setFullYear(lastCandidate.getFullYear() - (yearInterval - 1));
        lastDate = lastCandidate;
  
        // 3) SECOND-TO-LAST DATE
        let sYear  = lastCandidate.getFullYear();
        let sMonth = lastCandidate.getMonth() - monthInterval;
        while (sMonth < 0) {
          sYear -= 1;
          sMonth += 12;
        }
        let secondCandidate = getNthWeekdayFallback(sYear, sMonth, weekday, weekOccurrence);
        while (!secondCandidate) {
          sMonth -= monthInterval;
          while (sMonth < 0) {
            sYear -= 1;
            sMonth += 12;
          }
          secondCandidate = getNthWeekdayFallback(sYear, sMonth, weekday, weekOccurrence);
        }
        // year interval backward
        secondCandidate.setFullYear(secondCandidate.getFullYear() - (yearInterval - 1));
        secondToLastDate = secondCandidate;
      }
  
      // Now push nextDate, lastDate, secondToLastDate into the master arrays
      if (nextDate)         nextDates.push(nextDate);
      if (lastDate)         lastDates.push(lastDate);
      if (secondToLastDate) secondToLastDates.push(secondToLastDate);
    }
  
    // 9. Determine the earliest “next date” across combos
    const earliestNext = nextDates.length
      ? nextDates.reduce((earliest, current) => (current < earliest ? current : earliest))
      : null;
  
    // 10. Determine the latest “last date”
    const latestLast = lastDates.length
      ? lastDates.reduce((latest, current) => (current > latest ? current : latest))
      : null;
  
    // 11. Determine the latest “second-to-last date”
    const latestSecondLast = secondToLastDates.length
      ? secondToLastDates.reduce((latest, current) => (current > latest ? current : latest))
      : null;
  
    // 12. Format helper (YYYY-MM-DD)
    function formatDate(date) {
      if (!date || isNaN(date)) return null;
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  
    // 13. Return results
    return {
      secondToLastDate: formatDate(latestSecondLast),
      lastDate:         formatDate(latestLast),
      nextDate:         formatDate(earliestNext)
    };
  }
  
/* End of Selection */


/**
 * Generates the next N dates based on the code.
 * @param {string} code - The code specifying the intervals.
 * @param {number} numberOfDates - The number of dates to generate.
 * @param {Date} [currentDate=new Date()] - The starting date.
 * @returns {string[]} - An array of dates in ISO format.
 */
function generateNextDates(code, numberOfDates, currentDateInput = new Date()) {    
    // 1. Validate the currentDate
    const currentDate = new Date(currentDateInput);
    if (isNaN(currentDate)) {
        throw new Error('Invalid currentDate provided. Please provide a valid date.');
    }

    // 2. Split code into combinations
    const combinations = code.split('+').map(combo => combo.trim());

    // 3. For each combination, parse the parts and create a "getNextDate" function
    const nextDateFunctions = combinations.map(combo => {
        const parts = combo.split(/\s+/);

        let dayCode    = null; // { type: 'specific' | 'weekday', day: number }
        let weekOccur  = null; // integer 1..5
        let monthInt   = 1;    // Mx
        let yearInt    = 1;    // Yx
        let dayInt     = null; // DTx

        for (const part of parts) {
            if (part.startsWith('DT')) {
                // e.g. DT10
                const n = parseInt(part.slice(2), 10);
                if (isNaN(n) || n < 1) {
                    throw new Error(`Invalid day interval: ${part}`);
                }
                dayInt = n;
            } else if (part.startsWith('D')) {
                // e.g. D31T, D7, etc.
                if (part.endsWith('T')) {
                    // DxxT => specific day of the month
                    const d = parseInt(part.slice(1, -1), 10);
                    if (isNaN(d) || d < 1 || d > 31) {
                        throw new Error(`Invalid specific day code: ${part}`);
                    }
                    dayCode = { type: 'specific', day: d };
                } else {
                    // D1..D7 => weekday (1=Sunday ... 7=Saturday)
                    const d = parseInt(part.slice(1), 10);
                    if (isNaN(d) || d < 1 || d > 7) {
                        throw new Error(`Invalid weekday code: ${part}`);
                    }
                    // Convert to 0..6 => Sunday..Saturday
                    dayCode = { type: 'weekday', day: d - 1 };
                }
            } else if (part.startsWith('WO')) {
                // e.g. WO1..WO5 => nth occurrence
                const w = parseInt(part.slice(2), 10);
                if (isNaN(w) || w < 1 || w > 5) {
                    throw new Error(`Invalid week occurrence code: ${part}`);
                }
                weekOccur = w;
            } else if (part.startsWith('M')) {
                // e.g. M2 => every 2 months
                const m = parseInt(part.slice(1), 10);
                if (isNaN(m) || m < 1) {
                    throw new Error(`Invalid month interval: ${part}`);
                }
                monthInt = m;
            } else if (part.startsWith('Y')) {
                // e.g. Y2 => every 2 years
                const y = parseInt(part.slice(1), 10);
                if (isNaN(y) || y < 1) {
                    throw new Error(`Invalid year interval: ${part}`);
                }
                yearInt = y;
            } else {
                throw new Error(`Unknown code part: ${part}`);
            }
        }

        // --- Helper Functions ---

        // A) If we have DT, it’s just day-based intervals:
        function getNextForDayInterval(fromDate) {
            const next = new Date(fromDate);
            next.setDate(next.getDate() + dayInt);
            return next;
        }

        // B) If we have a specific day (DxxT)
        //    Clamps to the last day if day > #daysInMonth,
        //    fallback if it's in the past, tries the same month (no skip).
        function getNextForSpecificDay(fromDate) {
            let year  = fromDate.getFullYear();
            let month = fromDate.getMonth();

            // Build a date in the *current* month first
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const desiredDay  = (dayCode.day > daysInMonth) ? daysInMonth : dayCode.day;

            let target = new Date(year, month, desiredDay);

            // If that date is <= 'fromDate', we look at the next month
            // BUT let's see if we want "no skip" meaning if dayCode.day=31 but fromDate=the 30th => we can still do 31 if it exists
            // Actually we only skip forward if it's truly less (or equal).
            if (target <= fromDate) {
                // move ahead by monthInt
                // but in small increments if monthInt>1, we do that many months
                month += monthInt;

                // normalize year/month
                while (month > 11) {
                    year  += 1;
                    month -= 12;
                }

                const daysNewMonth = new Date(year, month + 1, 0).getDate();
                const dDay         = (dayCode.day > daysNewMonth) ? daysNewMonth : dayCode.day;
                target = new Date(year, month, dDay);
            }

            // now apply year interval (Y2 => +1 year to get the “next” if that’s how you interpret it, or Y2 => skip 2 years, etc.)
            // Typically Y2 means “every 2 years” so from the first occurrence, we’d add + (2 -1) = +1? 
            // If you want to jump 2 full years from now, do +2. 
            // We'll do the standard approach: + (yearInt - 1)
            target.setFullYear(target.getFullYear() + (yearInt - 1));

            return target;
        }

        // C) If we have a weekday w/o WO => next occurrence of that weekday in the future
        function getNextForPlainWeekday(fromDate) {
            const next = new Date(fromDate);
            let diff = dayCode.day - next.getDay();
            if (diff <= 0) diff += 7;
            next.setDate(next.getDate() + diff);
            return next;
        }

        // D) If we have a weekday + WO => pick nth occurrence
        //    If the nth occurrence doesn’t exist, fallback to (n-1), (n-2), etc.
        //    If absolutely none exist, *then* move to the next interval.
        function getNextForNthWeekday(fromDate) {
            let year  = fromDate.getFullYear();
            let month = fromDate.getMonth();

            // 1) Try current month for the nth occurrence
            let candidate = findNthOrFallback(year, month, dayCode.day, weekOccur);

            // 2) If the candidate is null or <= fromDate, we move forward by monthInt
            if (!candidate || candidate <= fromDate) {
                month += monthInt;
                // normalize
                while (month > 11) {
                    year  += 1;
                    month -= 12;
                }

                candidate = findNthOrFallback(year, month, dayCode.day, weekOccur);

                // if still null, we keep going in increments of monthInt (rare)
                while (!candidate) {
                    month += monthInt;
                    while (month > 11) {
                        year  += 1;
                        month -= 12;
                    }
                    candidate = findNthOrFallback(year, month, dayCode.day, weekOccur);
                }
            }

            // now apply year interval
            candidate.setFullYear(candidate.getFullYear() + (yearInt - 1));
            return candidate;
        }

        // --- Core Logic for "getNextDate" ---
        function getNextDate(fromDate) {
            // 1) Day Interval only? => DT
            if (dayInt && !dayCode) {
                return getNextForDayInterval(fromDate);
            }
            // 2) Specific day => DxxT
            if (dayCode && dayCode.type === 'specific') {
                return getNextForSpecificDay(fromDate);
            }
            // 3) Weekday => D1..D7
            if (dayCode && dayCode.type === 'weekday') {
                // 3a) No WO => plain weekday
                if (!weekOccur) {
                    return getNextForPlainWeekday(fromDate);
                }
                // 3b) Have WO => nth occurrence
                return getNextForNthWeekday(fromDate);
            }
            throw new Error(`Incomplete combination: "${combo}"`);
        }

        // Helper used by getNextForNthWeekday:
        // Attempt the nth occurrence. If it doesn't exist, fallback to n-1, etc.
        function findNthOrFallback(year, month, weekday, nth) {
            // e.g. weekday=2 => Tuesday, nth=5 => 5th Tuesday
            // If 5th doesn’t exist, try 4th, 3rd, etc.

            // We'll build from the largest fallback down
            for (let tryN = nth; tryN >= 1; tryN--) {
                const candidate = computeNthWeekday(year, month, weekday, tryN);
                if (candidate) {
                    return candidate;
                }
            }
            // If none exist, return null => triggers next month
            return null;
        }

        function computeNthWeekday(year, month, weekday, n) {
            const firstDay     = new Date(year, month, 1);
            const firstWeekday = firstDay.getDay(); // 0..6
            const offset       = (weekday - firstWeekday + 7) % 7;
            const dateNum      = 1 + offset + (n - 1) * 7;
            const lastDay      = new Date(year, month + 1, 0).getDate();
            if (dateNum > lastDay) return null;
            return new Date(year, month, dateNum);
        }

        return getNextDate;
    });

    // 4. Iteratively pick the earliest next date among all combinations
    const results = [];
    let fromDate  = new Date(currentDate);

    while (results.length < numberOfDates) {
        // For each combination, figure out the next date from 'fromDate'
        const candidates = nextDateFunctions.map(fn => fn(fromDate));

        // Find the earliest among them (strictly > fromDate)
        let earliest  = null;
        let earliestI = -1;

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            if (!earliest || c < earliest) {
                earliest  = c;
                earliestI = i;
            }
        }

        // If earliest is valid and strictly > fromDate, keep it
        if (earliest && earliest > fromDate) {
            const yyyy = earliest.getFullYear();
            const mm   = String(earliest.getMonth() + 1).padStart(2, '0');
            const dd   = String(earliest.getDate()).padStart(2, '0');
            results.push(`${yyyy}-${mm}-${dd}`);

            // Advance fromDate so next iteration picks strictly after
            fromDate = earliest;
        } else {
            // If we can't find anything strictly greater, break to avoid infinite loop
            break;
        }
    }

    return results;
}


/**
 * Calculates the transaction period (start and end dates) based on the code and a reference date.
 * @param {string} code - The code specifying the intervals.
 * @param {string} date - The reference date in ISO format (YYYY-MM-DD).
 * @returns {object} - An object containing the startDate and endDate in ISO format.
 */
function getTransactionPeriod(code, date) {
    console.log(code, date);
  
    // 1. Parse the reference date
    const referenceDate = new Date(date);
    if (isNaN(referenceDate)) {
      throw new Error("Invalid reference date provided.");
    }
  
    // 2. Split the code into combinations separated by '+'
    const combinations = code.split('+').map(c => c.trim());
  
    // We'll interpret the code sequentially to determine:
    //  - startDate: the first valid date matching code(s),
    //  - intervals: sum of M / Y / DT parts for endDate calculation.
  
    // 3. Initialize startDate based on referenceDate
    let startDate = new Date(referenceDate);
  
    // 4. Initialize interval accumulators
    let totalMonthInterval = 0;
    let totalYearInterval  = 0;
    let totalDayInterval   = 0;
  
    // 5. Helper: clampDayToMonth => if e.g. day=31 in April => 30
    function clampDayToMonth(year, month, desiredDay) {
      const daysInMonth = new Date(year, month + 1, 0).getDate(); // last day in {year, month}
      return (desiredDay > daysInMonth) ? daysInMonth : desiredDay;
    }
  
    // 6. Helper: getFallbackWeek => if W5 doesn’t exist, try W4, W3, ...
    function getFallbackWeek(originalWeek, daysInMonth) {
      // e.g. if user says W5 but it doesn't exist, we fallback to W4, W3, ...
      // if user says W1 but there's no full week? We'll just clamp to at least W1 => picks earliest part of month
      let w = originalWeek;
      while (w > 1) {
        // Check if this w is at least feasible
        // e.g. W5 means days 29..35 in a 31-day month => that might exist, but if it's 28-day month it won't
        // A quick approach is:
        //   The first day of W5 is day (4 * 7) + 1 = 29 (counting from W1=1..7)
        //   If 29 > daysInMonth, fallback to W4 => day(3 * 7 +1=22) => check if 22>daysInMonth => fallback etc.
        const firstDayOfWeek = (w - 1) * 7 + 1; // e.g. W5 => 29, W4 => 22, etc.
        if (firstDayOfWeek <= daysInMonth) {
          return w; // found a feasible week
        }
        w--;
      }
      // If nothing else, fallback to W1
      return 1;
    }
  
    // 7. Process each combination to set or adjust startDate and collect intervals
    for (const combination of combinations) {
      const parts = combination.split(/\s+/);
  
      // Each combination can contain multiple parts like: D2 W2 M3 or DT10 or M2 Y1, etc.
      for (const part of parts) {
        if (part.startsWith('D')) {
          // -----------------------------
          // Handle day codes
          // -----------------------------
          const isT = part.endsWith('T');
  
          // Extract dayNumber (accounting for trailing 'T' if present)
          const dayStr = isT 
            ? part.substring(1, part.length - 1)  // e.g. "D31T" => "31"
            : part.substring(1);                 // e.g. "D2"   => "2"
          const dayNumber = parseInt(dayStr, 10);
          if (isNaN(dayNumber) || dayNumber < 1) {
            throw new Error(`Invalid day code: ${part}`);
          }
  
          if (isT) {
            // e.g. D31T => specific day of the month
            // clamp if dayNumber doesn't exist
            const year  = startDate.getFullYear();
            const month = startDate.getMonth();
  
            let clampedDay = clampDayToMonth(year, month, dayNumber);
            startDate.setDate(clampedDay);
  
            // If after clamping, we ended up in the past relative to referenceDate,
            // you might choose to jump to the next month. But "no skip" means we keep it if it's valid.
            // If you do want to skip, you'd do something like:
            /*
               if (startDate < referenceDate) {
                 const newMonth = month + 1;
                 const newYear = year + Math.floor(newMonth / 12);
                 const nextMonth = newMonth % 12;
                 clampedDay = clampDayToMonth(newYear, nextMonth, dayNumber);
                 startDate = new Date(newYear, nextMonth, clampedDay);
               }
            */
          } else {
            // e.g. D2 => day of the week
            // Map D7 => Sunday(0), otherwise dayNumber => dayNumber
            // But the original code used dayNumber===7 => 0, else dayNumber => let diff = target - startDate.getDay()
            let targetDay = (dayNumber === 7) ? 0 : dayNumber; 
            let diff = targetDay - startDate.getDay();
            if (diff <= 0) diff += 7;
            startDate.setDate(startDate.getDate() + diff);
          }
        }
        else if (part.startsWith('W')) {
          // -----------------------------
          // Handle week codes (W1..W5)
          // -----------------------------
          let weekNumber = parseInt(part.substring(1), 10);
          if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 5) {
            throw new Error(`Invalid week code: ${part}`);
          }
  
          const year  = startDate.getFullYear();
          const month = startDate.getMonth();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
  
          // Fallback logic: if W5 doesn’t exist, fallback to W4, etc.
          const finalWeek = getFallbackWeek(weekNumber, daysInMonth);
  
          // The first day of that "finalWeek"
          // e.g. W1 => day(0*7+1)=1, W2=>8, W3=>15, W4=>22, W5=>29
          const computedDay = (finalWeek - 1) * 7 + 1;
          
          // Set startDate to that day
          startDate = new Date(year, month, computedDay);
  
        }
        else if (part.startsWith('M')) {
          // -----------------------------
          // Collect month intervals
          // -----------------------------
          const mVal = parseInt(part.substring(1), 10);
          if (isNaN(mVal) || mVal < 1) {
            throw new Error(`Invalid month interval: ${part}`);
          }
          totalMonthInterval += mVal;
        }
        else if (part.startsWith('Y')) {
          // -----------------------------
          // Collect year intervals
          // -----------------------------
          const yVal = parseInt(part.substring(1), 10);
          if (isNaN(yVal) || yVal < 1) {
            throw new Error(`Invalid year interval: ${part}`);
          }
          totalYearInterval += yVal;
        }
        else if (part.startsWith('DT')) {
          // -----------------------------
          // Collect day intervals
          // -----------------------------
          const dVal = parseInt(part.substring(2), 10);
          if (isNaN(dVal) || dVal < 1) {
            throw new Error(`Invalid day interval: ${part}`);
          }
          totalDayInterval += dVal;
        }
        else {
          // Unknown code part
          throw new Error(`Unknown code component: ${part}`);
        }
      }
    }
  
    // 8. Calculate endDate based on collected intervals
    //    We interpret these intervals as “from startDate plus these intervals”
    const endDate = new Date(startDate);
  
    // Year interval
    if (totalYearInterval !== 0) {
      endDate.setFullYear(endDate.getFullYear() + totalYearInterval);
    }
    // Month interval
    if (totalMonthInterval !== 0) {
      // If the day is 31 and the next month doesn't have 31, set it to the last valid day
      const currentDay = endDate.getDate();
      const currentMonth = endDate.getMonth();
      const currentYear  = endDate.getFullYear();
  
      let newMonth = currentMonth + totalMonthInterval;
      let newYear  = currentYear + Math.floor(newMonth / 12);
      newMonth     = newMonth % 12;
  
      // clamp day
      const clampedDay = clampDayToMonth(newYear, newMonth, currentDay);
  
      endDate.setFullYear(newYear);
      endDate.setMonth(newMonth);
      endDate.setDate(clampedDay);
    }
    // Day interval
    if (totalDayInterval !== 0) {
      endDate.setDate(endDate.getDate() + totalDayInterval);
    }
  
    // 9. Return the transaction period in ISO (YYYY-MM-DD)
    function formatISO(dateObj) {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  
    return {
      startDate: formatISO(startDate),
      endDate:   formatISO(endDate),
    };
  }
  

// Export the functions for use in other modules
module.exports = {
    validateCode,
    generateDates,
    generateNextDates,
    getTransactionPeriod,
};
