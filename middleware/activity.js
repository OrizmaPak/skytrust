const fs = require('fs').promises;
const path = require('path');
const { StatusCodes } = require('http-status-codes');

const activityMiddleware = async (res, userid, message, module) => {
  return
  // return
  const today = new Date();
  const date = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const filePath = path.join(__dirname, '../activities', `${date}.txt`); // Use __dirname for absolute path

  try {
    // Ensure the directory exists 
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Append the activity to the file
    const logEntry = `{"userid": "${userid}", "message": "${message}", "module": "${module}", "date": "${new Date().toISOString()}"}\n`;
    await fs.appendFile(filePath, logEntry);

    console.log(`Activity log for ${userid} on ${date} was successful.`);

  } catch (err) {
    console.error('Unexpected Error:', err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: 'An unexpected error occurred from activity log',
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [{ field: '', message: err.message }]
    });
  }
};

module.exports = { activityMiddleware };
