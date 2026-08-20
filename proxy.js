const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

// Binance klines proxy
app.get('/api/klines/:symbol/:interval', async (req, res) => {
    try {
        const { symbol, interval } = req.params;
        const response = await axios.get(`https://api.binance.com/api/v3/klines`, {
            params: { symbol, interval, limit: 500 }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Binance ticker proxy
app.get('/api/ticker/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr`, {
            params: { symbol }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`CORS Proxy running on http://localhost:${PORT}`);
});
