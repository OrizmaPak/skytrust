const multer = require('multer');

// Configure multer storage to store files in memory
const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

const largeNumericTextFields = new Set([
    'accountnumber',
    'bankaccountnumber',
    'bankaccountnumber1',
    'bankaccountnumber2',
    'cardnumber',
    'routingnumber'
]);

const shouldValidateIntegerSize = (key) => {
    const normalizedKey = String(key || '').toLowerCase();
    return !largeNumericTextFields.has(normalizedKey);
};

const trimBodyStrings = (body) => {
    if (!body || typeof body !== 'object') return;

    for (let key in body) {
        if (Object.prototype.hasOwnProperty.call(body, key) && typeof body[key] === 'string') {
            body[key] = body[key].trim();
        }
    }
};

// Middleware function to handle file uploads and form data
const requestprocessor = (req, res, next) => {
    const maxIntValue = 9999999999999; // Maximum value for a 32-bit integer

    // Check and parse body values
    for (let key in req.body) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
            if (!shouldValidateIntegerSize(key)) continue;
            const parsedValue = parseInt(req.body[key], 10);
            if (!isNaN(parsedValue) && parsedValue > maxIntValue) {
                const digitLength = req.body[key].length;
                return res.status(400).json({
                    status: false,
                    message: `Value for ${key} exceeds the maximum allowed integer value. Length of the digit: ${digitLength}`,
                    statuscode: 400,
                    data: null,
                    errors: []
                });
            }
        }
    }

    // Check and parse param values
    for (let key in req.params) {
        if (Object.prototype.hasOwnProperty.call(req.params, key)) {
            if (!shouldValidateIntegerSize(key)) continue;
            const parsedValue = parseInt(req.params[key], 10);
            if (!isNaN(parsedValue) && parsedValue > maxIntValue) {
                return res.status(400).json({
                    status: false,
                    message: `Value for ${key} exceeds the maximum allowed integer value`,
                    statuscode: 400,
                    data: null,
                    errors: []
                });
            }
        }
    }

    if (req.method !== 'POST' && req.method !== 'DELETE' && req.method !== 'PUT' && req.method !== 'PATCH') {
        trimBodyStrings(req.body);
        return next();
    }

    const contentType = (req.headers['content-type'] || '').toLowerCase();
    const isMultipart = contentType.includes('multipart/form-data');

    if (!isMultipart) {
        trimBodyStrings(req.body);
        return next();
    }

    upload.any()(req, res, (err) => {
        if (err) {
            return res.status(400).send('Error uploading files' + err);
        }

        req.body = req.body || {};
        trimBodyStrings(req.body);
        return next();
    });
};

module.exports = { requestprocessor }
