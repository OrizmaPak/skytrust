const Nodemailer = require("nodemailer");

async function sendEmail(details) {
    const { to, subject, text, html } = details;

    const transport = Nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.GMAIL_USER, // Your Gmail address
            pass: process.env.GMAIL_PASS  // Your Gmail password or App Password
        }
    });

    const msg = {
        to, // Recipient
        from: process.env.GMAIL_USER, // Your verified Gmail address
        subject,
        text,
        html
    };

    try {
        await transport.sendMail(msg);
        console.log("Email sent");
        return true;
    } catch (error) {
        console.error(error);
        return false
    }
}


// async function sendEmail(details) {
//     // sgMail.setApiKey(process.env.SENDGRID_KEY);

//     const { to, subject, text, html } = details;

//     const TOKEN = "02a249d084037d5b2395b97a1c708ab2";

//     const transport = Nodemailer.createTransport(
//       MailtrapTransport({
//         token: TOKEN,
//       })
//     );

//     const sender = {
//       address: "mailtrap@demomailtrap.com",
//       name: "Divine Help Farmers",
//     };
//     // const recipients = [
//     //   to,
//     // ];


//     const msg = {
//         to, // Change to your recipient
//         from: sender, // Change to your verified sender
//         subject,
//         text,
//         html
//     };

//     try {
//         await transport
//         .sendMail(msg);
//         console.log("Email sent");
//         return 'true';
//     } catch (error) {
//         console.error(error);
//         return 'false';
//     }
// }

module.exports = {sendEmail};

