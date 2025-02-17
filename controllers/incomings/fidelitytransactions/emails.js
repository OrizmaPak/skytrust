const fs = require('fs');
const path = require('path');

const saveMailDataToFile = (req, res) => {
    const data = req.body;

    if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Expected an array of objects' });
    }

    const filePath = path.join(__dirname, 'docs', 'mail.txt');

    data.forEach((item) => {
        const fileData = JSON.stringify(item);

        fs.appendFile(filePath, fileData + '\n', (err) => {
            if (err) {
                console.error('Error writing file:', err);
                return res.status(500).json({ error: 'Failed to save data' });
            }
        });
    });

    res.status(200).json({ message: 'Data saved successfully' });
};

module.exports = {
    saveMailDataToFile
};
