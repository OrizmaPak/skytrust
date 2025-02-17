const { StatusCodes } = require("http-status-codes");
const fs = require("fs");
const { generateText } = require("../../ai/ai");
require("dotenv").config(); // Load environment variables

// Import the Google Cloud client library
const vision = require("@google-cloud/vision");

// Create a client without explicitly passing credentials
const client = new vision.ImageAnnotatorClient();

/**
 * Converts the AI-generated text to a JSON object containing only the specified keys.
 *
 * @param {string} inputString - The raw text returned by the AI.
 * @returns {object} - The parsed JSON object or an error object.
 */
function convertToJson(inputString) {
  try {
    const cleanedString = inputString 
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsedJson = JSON.parse(cleanedString);

    const expectedKeys = [
      "phonenumber",
      "firstname",
      "lastname",
      "othernames",
      "email",
      "branch",
      "date_joined",
      "batch_no",
      "unit",
    ];

    const result = {};

    expectedKeys.forEach((key) => {
      result[key] = parsedJson.hasOwnProperty(key) ? parsedJson[key] : null;
    });

    return result;
  } catch (error) {
    return { error: "Invalid JSON format", details: error.message };
  }
}

/**
 * POST Handler to process the uploaded image, perform OCR using Google Cloud Vision, and extract specified fields.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function getfiletoobj(req, res) {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: true,
        message: "Image file is required",
        statuscode: StatusCodes.BAD_REQUEST,
        data: null,
        errors: [{ field: "file", message: "Image file is required" }],
      });
    }

    const file = files[0];

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
    const maxSizeInMB = 5;

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: true,
        message: "Invalid file type. Only JPEG and PNG are allowed.",
        statuscode: StatusCodes.BAD_REQUEST,
        data: null,
        errors: [{ field: "file", message: "Invalid file type. Only JPEG and PNG are allowed." }],
      });
    }

    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > maxSizeInMB) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: true,
        message: `File size exceeds the limit of ${maxSizeInMB}MB.`,
        statuscode: StatusCodes.BAD_REQUEST,
        data: null,
        errors: [{ field: "file", message: `File size exceeds the limit of ${maxSizeInMB}MB.` }],
      });
    }

    if (!file.path) {
      throw new Error("File path is missing.");
    }

    // Perform text detection using Google Cloud Vision
    const [result] = await client.textDetection(file.path);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      throw new Error("No text detected from the image.");
    }

    const text = detections[0].description;

    if (!text) {
      throw new Error("No text extracted from the image.");
    }

    const prompt = `
Your task is to analyze the text enclosed within <> and extract the following information into a JSON object based on the schema provided. 

**Required Keys**:
- phonenumber
- firstname
- lastname
- othernames
- email
- branch
- date_joined
- batch_no
- unit

**JSON Schema**:
{
  "phonenumber": "String",
  "firstname": "String",
  "lastname": "String",
  "othernames": "String?",
  "email": "String",
  "branch": "String",
  "date_joined": "DateTime",
  "batch_no": "String",
  "unit": "String"
}

**Extraction Rules**:
1. **phonenumber**: Extract the phone number in a standard format (e.g., 08034567890).
2. **firstname**: Extract the first name of the individual.
3. **lastname**: Extract the last name of the individual.
4. **othernames**: Extract any middle names or additional names if available; otherwise, set to null.
5. **email**: Extract the email address.
6. **branch**: Extract the branch or office location.
7. **date_joined**: Extract the date froom the part wherer we have 'DATE ADMITTED' the value format seen on the card could be 20|03|2023 or 20/03/2023 or 20-03-2024. 
Extract the date the individual joined, formatted as ISO 8601 (e.g., 2024-01-15).
8. **batch_no**: Extract the batch number. 
9. **unit**: Extract the unit information.

**Instructions**:
- Analyze the enclosed text and populate the JSON object strictly adhering to the schema.
- Ensure that **only** the specified keys are present in the JSON object.
- If a field is not found, set its value to null.
- Do not include any additional information or explanations outside of the JSON object.

**Example Output**:
{
  "phonenumber": "08045678911",
  "firstname": "John",
  "lastname": "Doe",
  "othernames": "Michael",
  "email": "john.doe@example.com",
  "branch": "Main Office",
  "date_joined": "2024-01-15",
  "batch_no": "B123",
  "unit": "5"
}

<${text}>

Ensure the output is a **valid JSON object** with no extra text or explanations.
`;

    const aitext = await generateText(prompt);

    const extractedData = convertToJson(aitext);

    if (extractedData.error) {
      throw new Error("AI failed to return a valid JSON object. " + extractedData.details);
    }

    return res.status(StatusCodes.OK).json({
      error: false,
      message: "Data extracted successfully",
      statuscode: StatusCodes.OK,
      data: { extractedData, rawText: text },
      errors: [],
    });
  } catch (error) {
    console.error("Processing Error:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: true,
      message: "Failed to process image",
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [{ message: error.message }],
    });
  }
} 
   
module.exports = {
  getfiletoobj,
};
