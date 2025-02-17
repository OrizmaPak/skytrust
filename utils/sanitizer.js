const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const { window } = new JSDOM('');
const domPurify = DOMPurify(window);

async function sanitizeRequest(request) {
    const sanitizedParams = {};
    const sanitizedBody = {};

    // Sanitize request parameters
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    for (const [key, value] of searchParams) {
        sanitizedParams[key] = sanitizeValue(value);
    }

    // Sanitize request body
    const body = request.body;
    for (const key in body) {
        sanitizedBody[key] = sanitizeValue(body[key]);
    }

    return { params: sanitizedParams, body: sanitizedBody };
}

function sanitizeValue(value) {
    // Using DOMPurify library for HTML sanitization
    const sanitizedValue = domPurify.sanitize(value);
    return sanitizedValue;
}

module.exports = {
    sanitizeRequest,
    sanitizeValue
};

