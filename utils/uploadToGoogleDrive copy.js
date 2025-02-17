// const { google } = require('googleapis')
// const path = require('path')
// const fs = require('fs')
// const CLIENT_ID = env("GOOGLE_CLIENT_ID")
// const CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET")
// const REDIRECT_URI = env("GOOGLE_REDIRECT_URI")
// const REFRESH_TOKEN = env("GOOGLE_REFRESH_TOKEN")


// async function uploadToGoogleDrive(res, file){

//         const oauth2Client = new google.auth.OAuth2(
//             CLIENT_ID,
//             CLIENT_SECRET,
//             REDIRECT_URI
//         );
        
//         oauth2Client.setCredentials({refresh_token: REFRESH_TOKEN})

//         const drive = google.drive({
//             version: 'v3',
//             auth: oauth2Client
//         })
        
//         const filePath = path.join(__dirname, file)

//         try{
//             const response = await drive.files.create({
//                 requestBody:{
//                     name: 'nameoffile',
//                     mimeType: 'image/jpg'
//                 },
//                 media:{
//                     mimeType: 'image/jpg',
//                     body: fs.createReadStream(filePath)
//                 }
//             })
//             if(response.id){
//                 // SET THE PERMISSION OF THE UPLOADED IMAGE
//                 await drive.permissions.create({
//                     fileId: response.id,
//                     requestBody: {
//                         role: 'reader',
//                         type: 'anyone'
//                     }
//                 })
                
//                const result = await drive.files.get({
//                     fieldId: response.id,
//                     fields: 'webViewLink, webContentLink',
//                 })

//                 return result
//             }
//         }catch(error){

//         }
// }

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Load environment variables (adjust to how you are handling env variables)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

async function uploadToGoogleDrive1(req, res) {
    const uploadedFiles = req.files; // Array of uploaded files
    if (!uploadedFiles || uploadedFiles.length === 0) {
        // No files were uploaded, return the request as is
        console.log('No files were uploaded');
        return req;
    } 

    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

    console.log('OAuth2 client created', oauth2Client);

    // Set the credentials
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    // Initialize the Google Drive API client
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Iterate over each file and upload to Google Drive
    for (let file of uploadedFiles) {
        try {
            // Construct the file path 
            const filePath = path.join(__dirname, '..', file.path);

            // Upload the file to Google Drive
            const response = await drive.files.create({
                requestBody: {
                    name: file.originalname, // Use the original file name
                    mimeType: file.mimetype
                },
                media: {
                    mimeType: file.mimetype,
                    body: fs.createReadStream(filePath)
                }
            });

            console.log('File uploaded successfully:', response.data);

            if (response.data.id) {
                // Set the file permission to be publicly accessible
                await drive.permissions.create({
                    fileId: response.data.id,
                    requestBody: {
                        role: 'reader',
                        type: 'anyone'
                    }
                });

                console.log('Permissions set successfully for file:', response.data.id);

                // Construct the preview link in the desired format
                const previewLink = `https://drive.google.com/thumbnail?id=${response.data.id}&sz=w2000`;

                // Add the preview link to the request body under the appropriate field name
                req.body[file.fieldname] = previewLink;

                // Delete the file from the server after uploading
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error('Error deleting the file:', err);
                    } else {
                        console.log(`File ${file.originalname} deleted successfully`);
                    }
                });
            }
        } catch (error) { 
            console.error(`Error uploading file ${file.originalname}:`, error);
            return res.status(500).json({ message: `Failed to upload file: ${file.originalname}` });
        }
    }

    // Return the modified request body (with the webViewLinks added)
    console.log('Modified request body:', req.body);
    return req;
} 

module.exports = { uploadToGoogleDrive1 };  
 