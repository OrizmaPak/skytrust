const Nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
const { isValidEmail } = require("./isValidEmail");

const MICROSOFT_DOMAINS = new Set([
    "hotmail.com",
    "outlook.com",
    "live.com",
    "msn.com"
]);

function normalizeRecipient(to) {
    if (Array.isArray(to)) {
        return to.map(normalizeRecipient).filter(Boolean);
    }

    if (typeof to !== "string") return "";
    return to.trim().toLowerCase();
}

function getEmailAddress(value) {
    const match = String(value || "").match(/<([^>]+)>/);
    return (match ? match[1] : value || "").trim();
}

function getSenderAddress() {
    return process.env.EMAIL_FROM_ADDRESS || getEmailAddress(process.env.EMAIL_FROM || process.env.GMAIL_USER);
}

function getSenderName() {
    return process.env.EMAIL_FROM_NAME || "Sky Trust Bank";
}

function buildFromHeader() {
    const address = getSenderAddress();
    const name = getSenderName();
    return name ? `"${name}" <${address}>` : address;
}

function validateRecipients(to) {
    const recipients = normalizeRecipient(to);
    const list = Array.isArray(recipients) ? recipients : [recipients];
    const invalid = list.filter(email => !isValidEmail(email));

    if (!list.length || invalid.length) {
        throw new Error(`Invalid email recipient${invalid.length ? `: ${invalid.join(", ")}` : ""}`);
    }

    return Array.isArray(recipients) ? recipients : recipients;
}

function hasMicrosoftRecipient(to) {
    const recipients = Array.isArray(to) ? to : [to];
    return recipients.some(email => MICROSOFT_DOMAINS.has(String(email).split("@")[1]));
}

async function sendWithSendGrid(message) {
    sgMail.setApiKey(process.env.SENDGRID_KEY);

    const { envelope, ...sendGridMessage } = message;
    const [response] = await sgMail.send(sendGridMessage);
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`SendGrid rejected email with status ${response.statusCode}`);
    }

    return true;
}

async function sendWithSmtp(message) {
    const transport = Nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || "gmail",
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER || process.env.GMAIL_USER,
            pass: process.env.SMTP_PASS || process.env.GMAIL_PASS
        },
        tls: {
            minVersion: "TLSv1.2"
        }
    });

    const info = await transport.sendMail(message);
    const rejected = info.rejected || [];

    if (rejected.length) {
        throw new Error(`Email rejected for recipient(s): ${rejected.join(", ")}`);
    }

    if (!info.accepted || !info.accepted.length) {
        throw new Error("Email was not accepted by the SMTP provider");
    }

    return true;
}

async function sendEmail(details) {
    const { subject, text, html } = details || {};
    const to = validateRecipients(details?.to);
    const fromAddress = getSenderAddress();

    if (!fromAddress || !isValidEmail(fromAddress)) {
        throw new Error("A valid sender email is not configured");
    }

    const message = {
        to,
        from: buildFromHeader(),
        replyTo: process.env.EMAIL_REPLY_TO || fromAddress,
        subject,
        text: text || html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        html,
        envelope: {
            from: fromAddress,
            to: Array.isArray(to) ? to : [to]
        },
        headers: {
            "X-Mailer": "Sky Trust Bank"
        }
    };

    try {
        if (process.env.SENDGRID_KEY) {
            await sendWithSendGrid(message);
        } else {
            await sendWithSmtp(message);
        }

        console.log(`Email accepted for ${Array.isArray(to) ? to.join(", ") : to}`);
        if (hasMicrosoftRecipient(to) && !process.env.SENDGRID_KEY) {
            console.warn("Microsoft recipient sent through SMTP. Configure SENDGRID_KEY with a verified sender for better Hotmail/Outlook delivery.");
        }
        return true;
    } catch (error) {
        console.error("Email send failed:", {
            to,
            subject,
            provider: process.env.SENDGRID_KEY ? "sendgrid" : "smtp",
            error: error.message
        });
        throw error;
    }
}

module.exports = { sendEmail };
