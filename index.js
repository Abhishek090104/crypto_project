
const axios = require('axios');
const mongoose = require('mongoose');
const express = require('express');
const cron = require('node-cron');
const connectDB = require('./db'); // Ensure this file connects MongoDB
const app = express();
const port = 3000;

connectDB();

//Schema for cryptocurrency data
const cryptoSchema = new mongoose.Schema({
  coinName: String,
  price: Number,
  marketCap: Number,
  '24hChange': Number,
  timestamp: { type: Date, default: Date.now }
});

const Crypto = mongoose.model('Crypto', cryptoSchema);

// API route to fetch latest cryptocurrency stats
app.get('/stats', async (req, res) => {
  const { coin } = req.query;

  if (!coin) {
    return res.status(400).json({ error: 'Coin parameter is required' });
  }

  try {
    const latestData = await Crypto.findOne({ coinName: coin }).sort({ timestamp: -1 });

    if (!latestData) {
      return res.status(404).json({ error: 'No data found for the specified coin' });
    }

    res.json({
      price: latestData.price,
      marketCap: latestData.marketCap,
      "24hChange": latestData['24hChange']
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching data' });
  }
});

// API route to calculate deviation for the last 100 records
app.get('/deviation', async (req, res) => {
  const { coin } = req.query;

  if (!coin) {
    return res.status(400).json({ error: 'Coin parameter is required' });
  }

  try {
    const records = await Crypto.find({ coinName: coin }).sort({ timestamp: -1 }).limit(100);

    if (records.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified coin' });
    }

    const prices = records.map(record => record.price);
    console.log("Prices for deviation calculation:", prices); // Debugging line
    const deviation = calculateStandardDeviation(prices);

    res.json({ deviation });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while calculating deviation' });
  }
});

// Function to calculate standard deviation
function calculateStandardDeviation(prices) {
  const n = prices.length;
  const mean = prices.reduce((sum, price) => sum + price, 0) / n;
  const squaredDifferences = prices.map(price => Math.pow(price - mean, 2));
  const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / n;
  return Math.sqrt(variance);
}

// Server listening on defined port
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Fetch cryptocurrency data every 2 hours
async function fetchCryptoData() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'bitcoin,matic-network,ethereum',
        vs_currencies: 'usd',
        include_market_cap: 'true',
        include_24hr_change: 'true'
      }
    });

    const data = response.data;
    const cryptos = [
      { coinName: 'bitcoin', price: data.bitcoin.usd + Math.random() * 10, marketCap: data.bitcoin.usd_market_cap, '24hChange': data.bitcoin.usd_24h_change }, // Added random variation for testing
      { coinName: 'matic-network', price: data['matic-network'].usd + Math.random() * 10, marketCap: data['matic-network'].usd_market_cap, '24hChange': data['matic-network'].usd_24h_change }, // Added random variation
      { coinName: 'ethereum', price: data.ethereum.usd + Math.random() * 10, marketCap: data.ethereum.usd_market_cap, '24hChange': data.ethereum.usd_24h_change } // Added random variation
    ];

    // Save each crypto data to the database
    for (const crypto of cryptos) {
      const newCrypto = new Crypto(crypto);
      await newCrypto.save();
      console.log(`Success: ${crypto.coinName} data saved to database.`);
    }

    console.log('Successfully fetched and stored cryptocurrency data.');
  } catch (error) {
    console.error('Error fetching data: ', error);
  }
}

// Schedule data fetching every 2 hours
cron.schedule('0 */2 * * *', () => {
  console.log('Fetching crypto data...');
  fetchCryptoData();
});
