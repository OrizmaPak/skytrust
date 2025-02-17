require('dotenv').config(); // Load environment variables from .env file
const OpenAI = require('openai');
const { generateNextDates } = require('../../utils/datecode');

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY, // This is the default and can be omitted
});

// Function to generate text using OpenAI
async function generateText(prompt) {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7, 
    });

    // Check if the response contains valid data 
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content.trim();
    } else {
      return 'AI failed to respond'
      throw new Error("No response from the model");
    }
  } catch (error) {
    return 'AI failed to respond'
    console.error("Error with OpenAI API:", error.response ? error.response.data : error.message);
    throw new Error("Failed to generate text");
  }
}

// Function to generate text using OpenAI
async function generateTextwithClient(prompt, req) {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7, 
    });

    // Check if the response contains valid data 
    if (response.choices && response.choices.length > 0) {
      console.log('Headers in ai:', req.headers);
      return response.choices[0].message.content.trim();
    } else {
      return 'AI failed to respond'
      throw new Error("No response from the model");
    }
  } catch (error) {
    return 'AI failed to respond'
    console.error("Error with OpenAI API:", error.response ? error.response.data : error.message);
    throw new Error("Failed to generate text");
  }
}

// Controller to handle the API request
const generateTextController = async (req, res) => {
  try {
    const { prompt } = req.body;

    // Validate that the prompt is provided
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required and must be a string" });
    }

    // Generate the text using the prompt
    const generatedText = await generateText(prompt);

    // Return the generated text in the response
    res.status(200).json({ generatedText });

  } catch (error) {
    // Handle any errors and send an appropriate response
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

async function generateDateCodeController(req, res) {
  try {
    const { sentence } = req.body;

    // Validate that the sentence is provided
    if (!sentence || typeof sentence !== "string") {
      return res.status(400).json({ error: "Sentence is required and must be a string" });
    }

    // Define the prompt with datecode instructions
    const prompt = `
    instrunction {{{Time Interval Coding System: Comprehensive Rules and Guidelines
    Introduction
    This document outlines a specific format of codes used to represent intervals of time. The system is designed to encode complex scheduling patterns succinctly. Below are the detailed rules, components, examples, and validations to ensure accurate code generation and interpretation.
    
    1. Code Components
    The coding system is composed of several components, each representing different aspects of time intervals. These components can be combined to form complex scheduling codes.
    
    A. Days (D1 to D7 and D1T to D31T)
    D1 to D7:
    
    Purpose: Represent the days of the week.
    Definitions:
    D1: Sunday
    D2: Monday
    D3: Tuesday
    D4: Wednesday
    D5: Thursday
    D6: Friday
    D7: Saturday
    Usage: Indicates a specific weekday.
    D1T to D31T:
    
    Purpose: Represent specific days of the calendar month.
    Definitions:
    D1T: 1st day of the month
    D2T: 2nd day of the month
    ...
    D31T: 31st day of the month
    Usage: Indicates a specific calendar day regardless of the weekday.
    Important Notes:
    
    Without the "T" suffix: Codes refer to weekdays.
    With the "T" suffix: Codes refer to specific calendar days.
    Validity:
    D1 to D7: Valid only for weekdays.
    D1T to D31T: Valid for specific days (1-31) of the month.
    B. Week Occurrences (WO1 to WO5)
    WO1 to WO5:
    Purpose: Represent the nth occurrence of a specific weekday within a month.
    Definitions:
    WO1: First occurrence (e.g., first Sunday)
    WO2: Second occurrence (e.g., second Monday)
    WO3: Third occurrence (e.g., third Tuesday)
    WO4: Fourth occurrence (e.g., fourth Wednesday)
    WO5: Fifth occurrence (e.g., fifth Thursday) (if applicable)
    Usage: Specifies the which occurrence of the specified weekday in the month.
    Important Notes:
    
    WO5 may not exist in all months, depending on the number of weeks.
    Week Occurrence must precede the Month Interval in the code.
    C. Months (M1, M2, M3, ...)
    M1, M2, M3, ...:
    Purpose: Represent monthly intervals.
    Definitions:
    M1: Every month
    M2: Every two months
    M3: Every three months
    ...
    Usage: Specifies the frequency of the event in terms of months.
    Important Notes:
    
    The number following "M" must be a positive integer (e.g., M1, M5, M12).
    D. Years (Y1, Y2, Y3, ...)
    Y1, Y2, Y3, ...:
    Purpose: Represent yearly intervals.
    Definitions:
    Y1: Every year
    Y2: Every two years
    Y3: Every three years
    ...
    Usage: Specifies the frequency of the event in terms of years.
    Important Notes:
    
    The number following "Y" must be a positive integer (e.g., Y1, Y5, Y10).
    E. Day Intervals (DT1, DT10, DT15, ...)
    DT1, DT10, DT15, ...:
    Purpose: Represent daily intervals.
    Definitions:
    DT1: Every day
    DT10: Every 10 days
    DT15: Every 15 days
    ...
    Usage: Specifies the frequency of the event in terms of days.
    Important Notes:
    
    The number following "DT" must be a positive integer (e.g., DT1, DT5, DT30).
    2. Combination Rules
    Codes can combine multiple components to represent complex scheduling patterns. The following rules govern how components can be combined.
    
    A. General Combination Rules
    Maximum Combinations:
    
    Up to 4 combinations are allowed within a single code.
    Separation:
    
    Plus sign (+) is used to separate different combinations.
    Within a single combination, components are space-separated.
    Order of Components:
    
    Day Component (D1 to D7 or D1T to D31T) comes first.
    Week Occurrence (WO1 to WO5) comes second (if applicable).
    Month Interval (M1, M2, ...) comes third.
    Year Interval (Y1, Y2, ...) comes fourth (if applicable).
    Day Interval (DT1, DT10, ...) is separate and can be a standalone combination.
    No Repetition Within a Combination:
    
    A specific component (e.g., D2) cannot be repeated within the same combination.
    Repetitions must be separated by a plus sign (+).
    Self-Containment:
    
    Each combination must be complete and unambiguous.
    All necessary components must be present to define the interval clearly.
    B. Specific Combination Scenarios
    Combining Weekday and Week Occurrence:
    
    Example: D3 WO2 M4
    D3: Tuesday
    WO2: Second occurrence
    M4: Every four months
    Meaning: Every second Tuesday of every four months.
    Combining Day Intervals with Other Components:
    
    Example: DT10 M1 + D1 WO1 M1
    DT10 M1: Every 10 days
    D1 WO1 M1: First Sunday of every month
    Meaning: Every 10 days and the first Sunday of every month.
    Multiple Combinations:
    
    Example: D2 WO2 M3 + DT15 Y1
    D2 WO2 M3: Every second Monday of every three months
    DT15 Y1: Every 15 days every year
    Meaning: Every second Monday of every three months and every 15 days every year.
    3. Validation Rules
    To ensure codes are valid and unambiguous, the following validation rules must be adhered to:
    
    A. Component Validity
    Days (D1 to D7):
    
    Must be within D1 (Sunday) to D7 (Saturday).
    Cannot exceed this range.
    Specific Days (D1T to D31T):
    
    Must be within D1T (1st day) to D31T (31st day).
    Cannot exceed this range.
    Week Occurrences (WO1 to WO5):
    
    Must be within WO1 (first occurrence) to WO5 (fifth occurrence).
    Cannot exceed this range.
    Months (M1, M2, M3, ...):
    
    The number following "M" must be a positive integer.
    No upper limit on the number.
    Years (Y1, Y2, Y3, ...):
    
    The number following "Y" must be a positive integer.
    No upper limit on the number.
    Day Intervals (DT1, DT10, DT15, ...):
    
    The number following "DT" must be a positive integer.
    No upper limit on the number.
    B. Combination Validity
    Maximum of 4 Combinations:
    
    A single code cannot contain more than 4 separate combinations.
    Separation with Plus Sign (+):
    
    Different combinations must be separated by a plus sign (+).
    No other separators are allowed.
    No Repetition Within a Combination:
    
    Duplicate components within a single combination are invalid.
    Example: D2 WO2 M3 D2 is invalid.
    Complete Combinations:
    
    Each combination must include all necessary components to define the interval.
    Incomplete combinations are invalid.
    Example: D2 M3 is invalid if WO2 is required for clarity.
    4. Examples
    A. Valid Codes
    Single Combination with Week Occurrence:
    
    Code: D3 WO2 M4
    Meaning: Every second Tuesday of every four months.
    Multiple Combinations:
    
    Code: D1T M1 + DT10
    Meaning: The first day of every month and every 10 days.
    Combination with Year Interval:
    
    Code: D6 WO5 M6 Y2
    Meaning: Every fifth Friday of every six months, every two years.
    Multiple Standalone Combinations:
    
    Code: DT10 + DT15 + D1 WO1 M1 + D2 WO2 M3
    Meaning: Every 10 days, every 15 days, the first Sunday of every month, and the second Monday of every three months.
    Example for "Every Second Tuesday of Every Three Months":
    
    Code: D3 WO2 M3
    Meaning: Every second Tuesday of every three months.
    B. Invalid Codes
    Invalid Day Without "T":
    
    Code: D8 M1
    Reason: D8 exceeds the valid range (D1 to D7).
    Invalid Week Occurrence:
    
    Code: D2 WO6 M3
    Reason: WO6 exceeds the valid range (WO1 to WO5).
    Zero Year Interval:
    
    Code: D1 WO1 M1 Y0
    Reason: Y0 is not a positive integer.
    Repetition Without Plus Sign:
    
    Code: DT10 DT15
    Reason: Repetition of codes without separation by a plus sign.
    Incomplete Combination:
    
    Code: D2 M3
    Reason: Missing WO2 to specify the second occurrence.
    Week Occurrence Without Day:
    
    Code: WO2 M3
    Reason: WO2 lacks an associated day component (D1-D7 or D1T-D31T).
    5. Applying the Rules
    Example 1: "Every Second Tuesday of Every Three Months"
    Code Representation:
    
    Copy code
    D3 WO2 M3
    Breakdown:
    
    D3: Tuesday
    WO2: Second occurrence of Tuesday in the month
    M3: Every three months
    Interpretation:
    
    The event occurs on the second Tuesday of every three months.
    Example 2: "Every Last Friday of Every Six Months"
    Code Representation:
    
    Copy code
    D6 WO5 M6
    Breakdown:
    
    D6: Friday
    WO5: Fifth occurrence of Friday in the month (if applicable)
    M6: Every six months
    Interpretation:
    
    The event occurs on the fifth Friday of every six months, if a fifth Friday exists in that month.
    Example 3: "Every 10 Days and the First Sunday of Every Month"
    Code Representation:
    
    Copy code
    DT10 + D1 WO1 M1
    Breakdown:
    
    DT10: Every 10 days
    D1 WO1 M1: First Sunday of every month
    Interpretation:
    
    The event occurs every 10 days and on the first Sunday of every month.
    Example 4: "Every Third Wednesday, Every 15 Days, and Every Fourth Thursday of Every Two Years"
    Code Representation:
    
    Copy code
    D4 WO4 M1 Y2 + D3 WO3 M1 Y2 + DT15
    Breakdown:
    
    D4 WO4 M1 Y2: Every fourth Wednesday of every year, every two years
    D3 WO3 M1 Y2: Every third Tuesday of every year, every two years
    DT15: Every 15 days
    Interpretation:
    
    The event occurs on the fourth Wednesday and third Tuesday of every year (every two years), and every 15 days.
    6. Step-by-Step Guide for Code Validation
    To ensure a code is valid, follow these steps:
    
    Split the Code into Combinations:
    
    Use the plus sign (+) to separate different combinations.
    Example: D3 WO2 M4 + DT10 splits into D3 WO2 M4 and DT10.
    Validate Each Combination Individually:
    
    Check Component Order:
    Day (D1-D7 or D1T-D31T) → Week Occurrence (WO1-WO5, if applicable) → Month Interval (M1, M2, ...) → Year Interval (Y1, Y2, ..., if applicable).
    Verify Component Values:
    Ensure all components are within their valid ranges.
    Ensure Completeness:
    For combinations involving weekdays, ensure both Day and Week Occurrence are present.
    Check for Repetitions:
    
    Ensure no duplicate components exist within the same combination.
    Repeated components must be separated by a plus sign (+).
    Confirm the Number of Combinations:
    
    Ensure there are no more than 4 combinations.
    Final Validation:
    
    If all combinations pass the above checks, the code is valid.
    Otherwise, identify and rectify the specific validation errors.
    7. Additional Considerations
    Handling WO5:
    
    Not all months have a fifth occurrence of a weekday.
    If WO5 is specified, ensure it exists in the targeted months.
    Combining Multiple Intervals:
    
    Ensure that combined intervals do not conflict or create ambiguous schedules.
    Clearly define each combination to maintain unambiguity.
    Extensibility:
    
    The system is designed to be flexible and extensible, allowing for future additions or modifications as needed.
    8. Summary
    This comprehensive guide establishes a robust framework for representing complex time intervals using a standardized coding system. By adhering to the outlined rules and validation steps, users can generate accurate and unambiguous codes for various scheduling needs.
    
    Key Takeaways:
    
    Use "D" codes for specifying weekdays or specific calendar days.
    Incorporate "WO" codes to denote the occurrence of a weekday within a month.
    Define intervals using "M", "Y", and "DT" codes for months, years, and day intervals, respectively.
    Combine components thoughtfully, ensuring clarity and avoiding ambiguity through proper separation and adherence to combination rules.
    Example Code Breakdown for Clarity:
    
    Code: D3 WO2 M3 + DT15 Y1
    
    Combination 1: D3 WO2 M3
    
    D3: Tuesday
    WO2: Second occurrence
    M3: Every three months
    Meaning: Every second Tuesday of every three months.
    Combination 2: DT15 Y1
    
    DT15: Every 15 days
    Y1: Every year
    Meaning: Every 15 days annually.
    End of Comprehensive Guide
  }}}    
You are a Date Code Generator. Using the provided instructions, convert the following sentence into a date code.

Sentence: "${sentence}"

Date Code:
return only the code and nothing else
    `;

    // Generate the date code using OpenAI
    const dateCode = await generateText(prompt);

    // Check if a date code was successfully generated
    if (!dateCode) {
      return res.status(500).json({
        status: false,
        message: "Failed to generate date code",
        statuscode: 500,
        data: null,
        errors: []
      });
    }

    // Send the generated date code in the response
    res.status(200).json({
      status: true,
      message: "Date code generated successfully",
      statuscode: 200,
      data: { dateCode },
      errors: []
    });

  } catch (error) {
    console.error("Error in generateDateCodeController:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      statuscode: 500,
      data: null,
      errors: [error.message]
    });
  }
}

async function generateSentenceController(req, res) {
  try {
    const { code } = req.query;

    const exampledates = await generateNextDates(code, 5)

    // Validate that the code is provided
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "code is required and must be a string" });
    }

    // Define the prompt with datecode instructions
    const prompt = `
    instrunction {{{Time Interval Coding System: Comprehensive Rules and Guidelines
    Introduction
    This document outlines a specific format of codes used to represent intervals of time. The system is designed to encode complex scheduling patterns succinctly. Below are the detailed rules, components, examples, and validations to ensure accurate code generation and interpretation.
    
    1. Code Components
    The coding system is composed of several components, each representing different aspects of time intervals. These components can be combined to form complex scheduling codes.
    
    A. Days (D1 to D7 and D1T to D31T)
    D1 to D7:
    
    Purpose: Represent the days of the week.
    Definitions:
    D1: Sunday
    D2: Monday
    D3: Tuesday
    D4: Wednesday
    D5: Thursday
    D6: Friday
    D7: Saturday
    Usage: Indicates a specific weekday.
    D1T to D31T:
    
    Purpose: Represent specific days of the calendar month.
    Definitions:
    D1T: 1st day of the month
    D2T: 2nd day of the month
    ...
    D31T: 31st day of the month
    Usage: Indicates a specific calendar day regardless of the weekday.
    Important Notes:
    
    Without the "T" suffix: Codes refer to weekdays.
    With the "T" suffix: Codes refer to specific calendar days.
    Validity:
    D1 to D7: Valid only for weekdays.
    D1T to D31T: Valid for specific days (1-31) of the month.
    B. Week Occurrences (WO1 to WO5)
    WO1 to WO5:
    Purpose: Represent the nth occurrence of a specific weekday within a month.
    Definitions:
    WO1: First occurrence (e.g., first Sunday)
    WO2: Second occurrence (e.g., second Monday)
    WO3: Third occurrence (e.g., third Tuesday)
    WO4: Fourth occurrence (e.g., fourth Wednesday)
    WO5: Fifth occurrence (e.g., fifth Thursday) (if applicable)
    Usage: Specifies the which occurrence of the specified weekday in the month.
    Important Notes:
    
    WO5 may not exist in all months, depending on the number of weeks.
    Week Occurrence must precede the Month Interval in the code.
    C. Months (M1, M2, M3, ...)
    M1, M2, M3, ...:
    Purpose: Represent monthly intervals.
    Definitions:
    M1: Every month
    M2: Every two months
    M3: Every three months
    ...
    Usage: Specifies the frequency of the event in terms of months.
    Important Notes:
    
    The number following "M" must be a positive integer (e.g., M1, M5, M12).
    D. Years (Y1, Y2, Y3, ...)
    Y1, Y2, Y3, ...:
    Purpose: Represent yearly intervals.
    Definitions:
    Y1: Every year
    Y2: Every two years
    Y3: Every three years
    ...
    Usage: Specifies the frequency of the event in terms of years.
    Important Notes:
    
    The number following "Y" must be a positive integer (e.g., Y1, Y5, Y10).
    E. Day Intervals (DT1, DT10, DT15, ...)
    DT1, DT10, DT15, ...:
    Purpose: Represent daily intervals.
    Definitions:
    DT1: Every day
    DT10: Every 10 days
    DT15: Every 15 days
    ...
    Usage: Specifies the frequency of the event in terms of days.
    Important Notes:
    
    The number following "DT" must be a positive integer (e.g., DT1, DT5, DT30).
    2. Combination Rules
    Codes can combine multiple components to represent complex scheduling patterns. The following rules govern how components can be combined.
    
    A. General Combination Rules
    Maximum Combinations:
    
    Up to 4 combinations are allowed within a single code.
    Separation:
    
    Plus sign (+) is used to separate different combinations.
    Within a single combination, components are space-separated.
    Order of Components:
    
    Day Component (D1 to D7 or D1T to D31T) comes first.
    Week Occurrence (WO1 to WO5) comes second (if applicable).
    Month Interval (M1, M2, ...) comes third.
    Year Interval (Y1, Y2, ...) comes fourth (if applicable).
    Day Interval (DT1, DT10, ...) is separate and can be a standalone combination.
    No Repetition Within a Combination:
    
    A specific component (e.g., D2) cannot be repeated within the same combination.
    Repetitions must be separated by a plus sign (+).
    Self-Containment:
    
    Each combination must be complete and unambiguous.
    All necessary components must be present to define the interval clearly.
    B. Specific Combination Scenarios
    Combining Weekday and Week Occurrence:
    
    Example: D3 WO2 M4
    D3: Tuesday
    WO2: Second occurrence
    M4: Every four months
    Meaning: Every second Tuesday of every four months.
    Combining Day Intervals with Other Components:
    
    Example: DT10 M1 + D1 WO1 M1
    DT10 M1: Every 10 days
    D1 WO1 M1: First Sunday of every month
    Meaning: Every 10 days and the first Sunday of every month.
    Multiple Combinations:
    
    Example: D2 WO2 M3 + DT15 Y1
    D2 WO2 M3: Every second Monday of every three months
    DT15 Y1: Every 15 days every year
    Meaning: Every second Monday of every three months and every 15 days every year.
    3. Validation Rules
    To ensure codes are valid and unambiguous, the following validation rules must be adhered to:
    
    A. Component Validity
    Days (D1 to D7):
    
    Must be within D1 (Sunday) to D7 (Saturday).
    Cannot exceed this range.
    Specific Days (D1T to D31T):
    
    Must be within D1T (1st day) to D31T (31st day).
    Cannot exceed this range.
    Week Occurrences (WO1 to WO5):
    
    Must be within WO1 (first occurrence) to WO5 (fifth occurrence).
    Cannot exceed this range.
    Months (M1, M2, M3, ...):
    
    The number following "M" must be a positive integer.
    No upper limit on the number.
    Years (Y1, Y2, Y3, ...):
    
    The number following "Y" must be a positive integer.
    No upper limit on the number.
    Day Intervals (DT1, DT10, DT15, ...):
    
    The number following "DT" must be a positive integer.
    No upper limit on the number.
    B. Combination Validity
    Maximum of 4 Combinations:
    
    A single code cannot contain more than 4 separate combinations.
    Separation with Plus Sign (+):
    
    Different combinations must be separated by a plus sign (+).
    No other separators are allowed.
    No Repetition Within a Combination:
    
    Duplicate components within a single combination are invalid.
    Example: D2 WO2 M3 D2 is invalid.
    Complete Combinations:
    
    Each combination must include all necessary components to define the interval.
    Incomplete combinations are invalid.
    Example: D2 M3 is invalid if WO2 is required for clarity.
    4. Examples
    A. Valid Codes
    Single Combination with Week Occurrence:
    
    Code: D3 WO2 M4
    Meaning: Every second Tuesday of every four months.
    Multiple Combinations:
    
    Code: D1T M1 + DT10
    Meaning: The first day of every month and every 10 days.
    Combination with Year Interval:
    
    Code: D6 WO5 M6 Y2
    Meaning: Every fifth Friday of every six months, every two years.
    Multiple Standalone Combinations:
    
    Code: DT10 + DT15 + D1 WO1 M1 + D2 WO2 M3
    Meaning: Every 10 days, every 15 days, the first Sunday of every month, and the second Monday of every three months.
    Example for "Every Second Tuesday of Every Three Months":
    
    Code: D3 WO2 M3
    Meaning: Every second Tuesday of every three months.
    B. Invalid Codes
    Invalid Day Without "T":
    
    Code: D8 M1
    Reason: D8 exceeds the valid range (D1 to D7).
    Invalid Week Occurrence:
    
    Code: D2 WO6 M3
    Reason: WO6 exceeds the valid range (WO1 to WO5).
    Zero Year Interval:
    
    Code: D1 WO1 M1 Y0
    Reason: Y0 is not a positive integer.
    Repetition Without Plus Sign:
    
    Code: DT10 DT15
    Reason: Repetition of codes without separation by a plus sign.
    Incomplete Combination:
    
    Code: D2 M3
    Reason: Missing WO2 to specify the second occurrence.
    Week Occurrence Without Day:
    
    Code: WO2 M3
    Reason: WO2 lacks an associated day component (D1-D7 or D1T-D31T).
    5. Applying the Rules
    Example 1: "Every Second Tuesday of Every Three Months"
    Code Representation:
    
    Copy code
    D3 WO2 M3
    Breakdown:
    
    D3: Tuesday
    WO2: Second occurrence of Tuesday in the month
    M3: Every three months
    Interpretation:
    
    The event occurs on the second Tuesday of every three months.
    Example 2: "Every Last Friday of Every Six Months"
    Code Representation:
    
    Copy code
    D6 WO5 M6
    Breakdown:
    
    D6: Friday
    WO5: Fifth occurrence of Friday in the month (if applicable)
    M6: Every six months
    Interpretation:
    
    The event occurs on the fifth Friday of every six months, if a fifth Friday exists in that month.
    Example 3: "Every 10 Days and the First Sunday of Every Month"
    Code Representation:
    
    Copy code
    DT10 + D1 WO1 M1
    Breakdown:
    
    DT10: Every 10 days
    D1 WO1 M1: First Sunday of every month
    Interpretation:
    
    The event occurs every 10 days and on the first Sunday of every month.
    Example 4: "Every Third Wednesday, Every 15 Days, and Every Fourth Thursday of Every Two Years"
    Code Representation:
    
    Copy code
    D4 WO4 M1 Y2 + D3 WO3 M1 Y2 + DT15
    Breakdown:
    
    D4 WO4 M1 Y2: Every fourth Wednesday of every year, every two years
    D3 WO3 M1 Y2: Every third Tuesday of every year, every two years
    DT15: Every 15 days
    Interpretation:
    
    The event occurs on the fourth Wednesday and third Tuesday of every year (every two years), and every 15 days.
    6. Step-by-Step Guide for Code Validation
    To ensure a code is valid, follow these steps:
    
    Split the Code into Combinations:
    
    Use the plus sign (+) to separate different combinations.
    Example: D3 WO2 M4 + DT10 splits into D3 WO2 M4 and DT10.
    Validate Each Combination Individually:
    
    Check Component Order:
    Day (D1-D7 or D1T-D31T) → Week Occurrence (WO1-WO5, if applicable) → Month Interval (M1, M2, ...) → Year Interval (Y1, Y2, ..., if applicable).
    Verify Component Values:
    Ensure all components are within their valid ranges.
    Ensure Completeness:
    For combinations involving weekdays, ensure both Day and Week Occurrence are present.
    Check for Repetitions:
    
    Ensure no duplicate components exist within the same combination.
    Repeated components must be separated by a plus sign (+).
    Confirm the Number of Combinations:
    
    Ensure there are no more than 4 combinations.
    Final Validation:
    
    If all combinations pass the above checks, the code is valid.
    Otherwise, identify and rectify the specific validation errors.
    7. Additional Considerations
    Handling WO5:
    
    Not all months have a fifth occurrence of a weekday.
    If WO5 is specified, ensure it exists in the targeted months.
    Combining Multiple Intervals:
    
    Ensure that combined intervals do not conflict or create ambiguous schedules.
    Clearly define each combination to maintain unambiguity.
    Extensibility:
    
    The system is designed to be flexible and extensible, allowing for future additions or modifications as needed.
    8. Summary
    This comprehensive guide establishes a robust framework for representing complex time intervals using a standardized coding system. By adhering to the outlined rules and validation steps, users can generate accurate and unambiguous codes for various scheduling needs.
    
    Key Takeaways:
    
    Use "D" codes for specifying weekdays or specific calendar days.
    Incorporate "WO" codes to denote the occurrence of a weekday within a month.
    Define intervals using "M", "Y", and "DT" codes for months, years, and day intervals, respectively.
    Combine components thoughtfully, ensuring clarity and avoiding ambiguity through proper separation and adherence to combination rules.
    Example Code Breakdown for Clarity:
    
    Code: D3 WO2 M3 + DT15 Y1
    
    Combination 1: D3 WO2 M3
    
    D3: Tuesday
    WO2: Second occurrence
    M3: Every three months
    Meaning: Every second Tuesday of every three months.
    Combination 2: DT15 Y1
    
    DT15: Every 15 days
    Y1: Every year
    Meaning: Every 15 days annually.
    End of Comprehensive Guide
  }}}    
You are a sentence Generator. Using the provided instructions, convert the following date codeinto a sentence.

 Date Code: "${code}"

Sentence:
    `;

    // Generate the date code using OpenAI
    const dateCode = await generateText(prompt);

    // Validate that a date code was generated
    if (!dateCode) {
      return res.status(500).json({
        status: false,
        message: "Failed to generate sentence",
        statuscode: 500,
        data: null,
        errors: []
      });
    }

    const formattedDates = exampledates.map((date, index) => {
      const [year, month, day] = date.split('-');
      const dateObj = new Date(year, month - 1, day);
      const options = { day: 'numeric', month: 'long', year: 'numeric' };
      const formattedDate = dateObj.toLocaleDateString('en-US', options).replace(',', '');
      
      // Add ordinal suffixes
      const dayWithSuffix = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(dateObj);
      const dayNumber = parseInt(dayWithSuffix, 10);
      const suffix = (dayNumber % 10 === 1 && dayNumber !== 11) ? 'st' :
                     (dayNumber % 10 === 2 && dayNumber !== 12) ? 'nd' :
                     (dayNumber % 10 === 3 && dayNumber !== 13) ? 'rd' : 'th';
      
      return `<li>${formattedDate.replace(dayWithSuffix, `${dayWithSuffix}${suffix}`)}</li>`;
    }).join('');

    // Return the generated sentence
    res.status(200).json({
      status: true,
      message: "Sentence generated successfully",
      statuscode: 200,
      data: { sentence: `${dateCode} 😊 <span style="color: red">Examples of the next five dates are:</span><ol>${formattedDates.replace(/<li>(.*?)<\/li>/g, '<li><b>$1</b></li>')}</ol>,  Please let me know how the system performed` },
      errors: []
    });
   
  } catch (error) {
    console.error("Error in generateSentenceController:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      statuscode: 500,
      data: null,
      errors: [error.message]
    });
  }
}


module.exports = {
  generateTextController,
  generateText,
  generateDateCodeController,
  generateSentenceController,
  generateTextwithClient
};
 