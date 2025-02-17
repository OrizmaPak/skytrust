const express = require('express');
const { generateTextController, generateDateCodeController, generateSentenceController } = require('../controllers/ai/ai');
const router = express.Router();



// CREATE INVENTORY
router.route('/testai')
    .post(generateTextController)

router.route('/generatedatecode')
    .post(generateDateCodeController)

router.route('/generatesentence')
    .get(generateSentenceController)


    

module.exports = router;