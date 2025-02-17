const CryptoJS = require('crypto-js');

const encryption = (payload) => {
  let cypherText = CryptoJS.AES.encrypt(JSON.stringify(payload), process.env.ENC_SECRET_KEY);
  return cypherText.toString();
};

const decryption = (cypherText) => {
  let originalText = CryptoJS.AES.decrypt(cypherText, process.env.ENC_SECRET_KEY).toString(CryptoJS.enc.Utf8);
  return originalText;
};



const decryptMiddleware = async (req, res, next) => {

    return next()

    if (req.headers['skip-enc'] === 'true') {
        return next();
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        try {
            const originalText = decryption(req.body);
            req.body = JSON.parse(originalText);
            // Sanitize the decrypted body using express-validator
            req.body = await req.sanitizeBody();
        } catch (error) {
            return encryptResponseMiddleware(req, res, next); 
        }
    }

    next(); 
};



const encryptResponseMiddleware = (req, res, next) => {

    return next()

    const originalJson = res.json;

    res.json = function (data) {
        if (req.headers['skip-enc'] !== 'true') {
            const cypherText = encryption(data);
            return originalJson.call(this, cypherText);
        } 

        return originalJson.call(this, data);
    };

    next();
};







module.exports = {
    decryptMiddleware,
    encryptResponseMiddleware,
    encryption,
    decryption
};