const express = require('express');
const axios = require('axios');
const { generateJwt } = require("@coinbase/cdp-sdk/auth");
require('dotenv').config();

const app = express();
app.use(express.json());

const COINBASE_API_URL = 'https://api.coinbase.com';
const COINBASE_API_KEY = process.env.COINBASE_API_KEY_NAME;
const COINBASE_PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY;
const SECURITY_KEY = process.env.SECURITY_KEY;

console.log(`\n🔑 API Configuration:`);
console.log(`   API Key: ${!!COINBASE_API_KEY}`);
console.log(`   Private Key: ${!!COINBASE_PRIVATE_KEY}`);
console.log(`   Security Key: ${!!SECURITY_KEY}\n`);

async function createJWT(path, method = 'GET') {
  if (!COINBASE_PRIVATE_KEY) throw new Error('COINBASE_PRIVATE_KEY not set');
  
  const token = await generateJwt({
    apiKeyId: COINBASE_API_KEY,
    apiKeySecret: COINBASE_PRIVATE_KEY,
    requestMethod: method,
    requestHost: 'api.coinbase.com',
    requestPath: path
  });
  
  return token;
}

app.post('/webhook', async (req, res) => {
  try {
    const { action, symbol, size, security_key } = req.body;
    console.log(`\n🔔 Webhook received`);
    
    if (!security_key || security_key !== SECURITY_KEY) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    if (!action || !symbol || !size) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }
    
    if (!['buy', 'sell'].includes(action.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    const tradeResult = await executeTrade(action, symbol, size);
    return res.status(200).json({ success: true, order: tradeResult });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

async function executeTrade(action, symbol, size) {
  try {
    const clientOrderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const orderData = {
      client_order_id: clientOrderId,
      product_id: symbol,
      side: action.toUpperCase(),
      order_configuration: {
        market_market_ioc: {
          quote_size: size.toString()
        }
      }
    };
    
    const token = await createJWT('/api/v3/brokerage/orders', 'POST');
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    console.log(`📤 Placing order...`);
    const response = await axios.post(`${COINBASE_API_URL}/api/v3/brokerage/orders`, orderData, { headers });
    
    console.log(`✅ Order placed: ${response.data.success_response.order_id}`);
    return response.data.success_response;
  } catch (error) {
    console.error(`❌ Trade failed:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

app.get('/', (req, res) => {
  res.json({ status: '✅ Bot running', has_key: !!COINBASE_API_KEY, has_private: !!COINBASE_PRIVATE_KEY });
});

app.get('/accounts', async (req, res) => {
  try {
    const token = await createJWT('/api/v3/brokerage/accounts', 'GET');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    
    const response = await axios.get(`${COINBASE_API_URL}/api/v3/brokerage/accounts`, { headers });
    const balances = response.data.accounts.filter(acc => parseFloat(acc.available_balance.value) > 0);
    
    res.json({ success: true, balances: balances.map(acc => ({ currency: acc.currency, available: acc.available_balance.value })) });
  } catch (error) {
    console.error('❌ /accounts error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🤖 Bot started on port ${PORT}\n`);
});
