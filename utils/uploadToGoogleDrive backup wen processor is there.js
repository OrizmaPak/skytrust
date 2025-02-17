const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Configure Cloudinary with your credentials
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadToGoogleDrive(req, res) {
    console.log('Starting uploadToGoogleDrive function');
    const uploadedFiles = req.files; // Array of uploaded files
    console.log('Uploaded files:', uploadedFiles);

    if (!uploadedFiles || uploadedFiles.length === 0) {
        // No files were uploaded, return the request as is
        console.log('No files were uploaded');
        return req;
    }

    // Iterate over each file and upload to Cloudinary 
    for (let file of uploadedFiles) {
        console.log('Processing file:', file.originalname);
        try {
            // Construct the file path
            const filePath = path.join(__dirname, '..', file.path);
            console.log('File path constructed:', filePath);

            // Upload the file to Cloudinary
            const result = await cloudinary.uploader.upload(filePath, {
                resource_type: 'auto',
                public_id: file.originalname.split('.')[0] // Use the original file name without extension
            });

            console.log('File uploaded successfully:', result);

            // Add the secure URL to the request body under the appropriate field name
            req.body[file.fieldname] = result.secure_url;
            console.log(`Secure URL added to request body for field ${file.fieldname}:`, result.secure_url);

            // Delete the file from the server after uploading
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error deleting the file:', err);
                } else {
                    console.log(`File ${file.originalname} deleted successfully`);
                }
            });
        } catch (error) {
            console.error(`Error uploading file ${file.originalname}:`, error);
            return res.status(500).json({ message: `Failed to upload file: ${file.originalname}` });
        }
    }

    // Return the modified request body (with the secure URLs added)
    console.log('Modified request body:', req.body);
    console.log('uploadToGoogleDrive function completed');
    return req;
}

module.exports = { uploadToGoogleDrive };
