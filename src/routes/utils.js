const express = require('express');
const router = express.Router();
const axios = require('axios');

// Proxy route for Google Transliteration to avoid CORS
router.get('/transliterate', async (req, res) => {
    try {
        const { text } = req.query;
        if (!text) {
            return res.status(400).json({ error: 'Text prompt is required' });
        }

        const response = await axios.get('https://inputtools.google.com/request', {
            params: {
                text: text,
                itc: 'mr-t-i0-und',
                num: '1',
                cp: '0',
                cs: '1',
                ie: 'utf-8',
                oe: 'utf-8',
                app: 'demopage'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Transliteration API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch transliteration' });
    }
});

module.exports = router;
