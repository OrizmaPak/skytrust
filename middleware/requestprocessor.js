const multer = require('multer');

// Configure multer storage to store files in memory
const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

// Middleware function to handle file uploads and form data
const requestprocessor = (req, res, next) => {
    const maxIntValue = 9999999999999; // Maximum value for a 32-bit integer

    // Check and parse body values
    for (let key in req.body) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
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

    if(req.method !== 'POST' && req.method !== 'DELETE'){
        return next();
    } else {
        upload.any()(req, res, (err) => {
            if (err) {
                return res.status(400).send('Error uploading files' + err);
            }
            
            // Handle files
            const files = req.files; // Array of uploaded files
            console.log('files 111', req.files);
            if (files) {
                files.forEach(file => {
                    console.log(`Uploaded file: ${file.originalname}`);
                });
            }
            
            if(files && files.length == 0){
                console.log('No files found in the request');
            }
    
            // Handle form fields
            req.body = req.body || {}; 
            for (let key in req.body) {
                if (Object.prototype.hasOwnProperty.call(req.body, key) && typeof req.body[key] === 'string') {
                    req.body[key] = req.body[key].trim();
                }
            }
    
            // Proceed to the next middleware or route handler
            return next(); 
        });
    }
};

module.exports = { requestprocessor }