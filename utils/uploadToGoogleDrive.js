const cloudinary = require('cloudinary').v2;

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
  
    // Use Promise.all to wait for all files to be uploaded
    try {
        const uploadPromises = uploadedFiles.map(file => {
            console.log('Processing file:', file.originalname);
            return new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({
                    resource_type: 'auto',
                    public_id: file.originalname.split('.')[0] // Use the original file name without extension
                }, (error, result) => {
                    if (error) {
                        console.error(`Error uploading file ${file.originalname}:`, error);
                        reject(`Failed to upload file: ${file.originalname}`);
                    } else {
                        console.log('File uploaded successfully:', result);
                        // Add the secure URL to the request body under the appropriate field name
                        req.body[file.fieldname] = result.secure_url;
                        console.log(`Secure URL added to request body for field ${file.fieldname}:`, result.secure_url);
                        resolve();
                    }
                }).end(file.buffer);
            });
        });

        await Promise.all(uploadPromises);
    } catch (error) {
        console.error('Error during file upload:', error);
        return res.status(500).json({ message: error });
    }

    // Return the modified request body (with the secure URLs added)
    console.log('Modified request body:', req.body);
    console.log('uploadToGoogleDrive function completed');
    return req;
}

module.exports = { uploadToGoogleDrive };
