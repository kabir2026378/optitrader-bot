const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

const COINBASE_API_URL = 'https://api.coinbase.com';
const CB_ACCESS_KEY = process.env.COINBASE_API_KEY_NAME;
const CB_ACCESS_SECRET = process.env.COINBASE_PRIVATE_KEY;
const SECURITY_KEY = process.env.SECURITY_KEY;

console.log(`\n✅ Bot with Coinbase HMAC-SHA256 Headers\n`);

function createSignature(timestamp, method, requestPath, body = '') {
  const message = timestamp + method + requestPath + body;
  return crypto.createHmac('sha256', CB_ACCESS_SECRET).update(message).digest('base64');
}

app.post('/webhook', async (req, res) => {
  try {
    const { action, symbol, size, security_key } = req.body;
    if (!security_key || security_key !== SECURITY_KEY) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!action || !symbol || !size) return res.status(400).json({ success: false, error: 'Missing fields' });
    if (!['buy', 'sell'].includes(action.toLowerCase())) return res.status(400).json({ success: false, error: 'Invalid action' });
    
    const tradeResult = await executeTrade(action, symbol, size);
    return res.status(200).json({ success: true, order: tradeResult });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

async function executeTrade(action, symbol, size) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const method = 'POST';
  const requestPath = '/api/v3/brokerage/orders';
  const body = JSON.stringify({
    client_order_id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    product_id: symbol,
    side: action.toUpperCase(),
    order_configuration: { market_market_ioc: { quote_size: size.toString() } }
  });
  
  const signature = createSignature(timestamp, method, requestPath, body);
  
  const headers = {
    'CB-ACCESS-KEY': CB_ACCESS_KEY,
    'CB-ACCESS-SIGN': signature,
    'CB-ACCESS-TIMESTAMP': timestamp,
    'Content-Type': 'application/json'
  };
  
  const response = await axios.post(`${COINBASE_API_URL}${requestPath}`, body, { headers });
  return response.data.success_response;
}

app.get('/', (req, res) => res.json({ status: 'OK' }));

app.get('/accounts', async (req, res) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    const requestPath = '/api/v3/brokerage/accounts';
    const signature = createSignature(timestamp, method, requestPath);
    
    const headers = {
      'CB-ACCESS-KEY': CB_ACCESS_KEY,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp
    };
    
    const response = await axios.get(`${COINBASE_API_URL}${requestPath}`, { headers });
    const balances = response.data.accounts.filter(acc => parseFloat(acc.available_balance.value) > 0);
    res.json({ success: true, balances: balances.map(acc => ({ currency: acc.currency, available: acc.available_balance.value })) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot on port ${PORT}`));
