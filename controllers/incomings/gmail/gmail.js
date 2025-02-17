const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../../../utils/sendEmail');

const saveGmailDataToFile = async (req, res) => {
    const { subject, to, firstname, ...data } = req.body;

    if (!subject || !to) {
        return res.status(400).json({ error: 'Subject, email, and firstname are required' });
    }

    // const sendEmail = ({ to, subject, text, html }) => {
    //     console.log(`Sending email to: ${to} with subject: ${subject}`);
    //     // Here you would implement the actual email sending logic
    // };

    let msg = await sendEmail({
        to,
        subject: 'Welcome to divine Help Farmers! 🎉',
        text: 'Your journey to financial freedom begins now.',
        html: `<!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to divine Help Farmers!</title>
              </head>
              <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                  <div style="background-color: #4CAF50; padding: 20px; text-align: center; color: #ffffff;">
                    <h1 style="margin: 0;">Welcome to divine Help Farmers! 🎉</h1>
                  </div>
                  <div style="padding: 20px;">
                    <p style="font-size: 16px; color: #333333;">Hi <strong>${'testing name'}</strong>,</p>
                    <p style="font-size: 16px; color: #333333;">Welcome to <strong>divine Help Farmers Multi-Purpose Cooperative Society</strong>! We're excited to have you join our cooperative on the path to <strong>financial freedom</strong>.</p>
                    <h2 style="color: #4CAF50;">What’s Next?</h2>
                    <ul style="font-size: 16px; color: #333333; padding-left: 20px;">
                      <li>Login: <p style="color: red;font-weight: bold">Login with your email and use your registered phone number as password</p></li>
                      <li>Empower Your Finances: Join a community of farmers and members working together towards prosperity.</li>
                      <li>Set and Achieve Goals: Benefit from savings plans, loans, and financial growth strategies tailored for you.</li>
                      <li>Monitor Your Progress: Track your contributions, loan status, and more through detailed reports.</li>
                    </ul>
                    <h2 style="color: #4CAF50;">Get Started</h2>
                    <ol style="font-size: 16px; color: #333333; padding-left: 20px;">
                      <li><a href="#" style="color: #4CAF50; text-decoration: none;">Log in to your account</a> using the email you registered with: [User's Email].</li>
                      <li>Update your profile and financial preferences.</li>
                      <li>Start your journey towards financial empowerment with us!</li>
                    </ol>
                    <p style="font-size: 16px; color: #333333;">If you have any questions or need assistance, feel free to reach out to our support team at <a href="mailto:support@divinehelp.com" style="color: #4CAF50; text-decoration: none;">support@divinehelp.com</a>.</p>
                    <p style="font-size: 16px; color: #333333;">Thank you for choosing divine Help Farmers Cooperative. We’re here to help you reach your financial goals and achieve lasting success!</p>
                  </div>
                  <div style="background-color: #f4f4f4; padding: 20px; text-align: center;">
                    <p style="font-size: 12px; color: #666666;">&copy; 2024 divine Help Farmers Multi-Purpose Cooperative Society. All rights reserved.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
    });
    console.log(msg)
    if(msg)res.status(200).json({ message: 'Email sent successfully' })
        else res.status(500).json({ message: 'Email failed to send' })
};
// const saveGmailDataToFile = (req, res) => {
//     const { subject, ...data } = req.body;

//     if (!subject) {
//         return res.status(400).json({ error: 'Subject is required' });
//     }

//     const filePath = path.join(__dirname, './testcontainer', `${subject}.txt`);
//     const fileData = JSON.stringify(data, null, 2);

//     fs.writeFile(filePath, fileData, (err) => {
//         if (err) {
//             console.error('Error writing file:', err);
//             return res.status(500).json({ error: 'Failed to save data' });
//         }

//         res.status(200).json({ message: 'Data saved successfully' });
//     });
// };
 
module.exports = {
    saveGmailDataToFile
};
