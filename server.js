const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
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

function createJWT(path, method = 'GET') {
  if (!COINBASE_PRIVATE_KEY) throw new Error('COINBASE_PRIVATE_KEY not set');
  
  let privateKey = COINBASE_PRIVATE_KEY.toString().trim();

  // Fix: Split by spaces and reconstruct proper PEM format
  if (!privateKey.includes('\n') && privateKey.includes(' -----')) {
    console.log('🔑 Converting single-line key to proper PEM format...');
    
    // Split by spaces to get individual parts
    const parts = privateKey.split(' ');
    const begin = parts[0];  // -----BEGIN EC PRIVATE KEY-----
    const end = parts[parts.length - 1];  // -----END EC PRIVATE KEY-----
    const base64 = parts.slice(1, -1).join('');  // Base64 without spaces
    
    // Format base64 to 64 chars per line (PEM standard)
    privateKey = `${begin}\n${base64.match(/.{1,64}/g).join('\n')}\n${end}`;
  }

  if (!privateKey.includes('BEGIN EC PRIVATE KEY')) {
    throw new Error('Invalid key format: missing BEGIN EC PRIVATE KEY');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: COINBASE_API_KEY,
    iss: 'cdp_service',
    nbf: now,
    exp: now + 120,
    iat: now,
    uri: `${method} ${path}`
  };

  return jwt.sign(payload, privateKey, { algorithm: 'ES256' });
}

function getAuthHeaders(path, method = 'GET') {
  return {
    'Authorization': `Bearer ${createJWT(path, method)}`,
    'Content-Type': 'application/json'
  };
}

app.post('/webhook', async (req, res) => {
  try {
    const { action, symbol, size, security_key } = req.body;

    console.log(`\n🔔 Webhook received`);
    console.log(`   Action: ${action}, Symbol: ${symbol}, Size: ${size}`);

    if (!security_key || security_key !== SECURITY_KEY) {
      console.warn(`⚠️ Unauthorized webhook attempt`);
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!action || !symbol || !size) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    if (!['buy', 'sell'].includes(action.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    const tradeResult = await executeTrade(action, symbol, size);
    console.log(`✅ Trade executed successfully\n`);

    return res.status(200).json({
      success: true,
      message: `Trade executed: ${action.toUpperCase()} $${size} ${symbol}`,
      order: tradeResult
    });
  } catch (error) {
    console.error(`❌ Webhook error:`, error.message);
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

    const headers = getAuthHeaders('/api/v3/brokerage/orders', 'POST');

    console.log(`📤 Placing order on Coinbase...`);

    const response = await axios.post(
      `${COINBASE_API_URL}/api/v3/brokerage/orders`,
      orderData,
      { headers }
    );

    console.log(`✅ Order placed successfully!`);
    console.log(`   Order ID: ${response.data.success_response.order_id}`);

    return response.data.success_response;
  } catch (error) {
    console.error(`❌ Trade failed:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

app.get('/', (req, res) => {
  res.json({
    status: '✅ Bot running',
    has_api_key: !!COINBASE_API_KEY,
    has_private_key: !!COINBASE_PRIVATE_KEY,
    has_security_key: !!SECURITY_KEY
  });
});

app.get('/accounts', async (req, res) => {
  try {
    const headers = getAuthHeaders('/api/v3/brokerage/accounts', 'GET');
    const response = await axios.get(
      `${COINBASE_API_URL}/api/v3/brokerage/accounts`,
      { headers }
    );

    const balances = response.data.accounts.filter(
      acc => parseFloat(acc.available_balance.value) > 0
    );

    res.json({
      success: true,
      balances: balances.map(acc => ({
        currency: acc.currency,
        available: acc.available_balance.value,
        hold: acc.hold.value
      }))
    });
  } catch (error) {
    console.error('❌ /accounts error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🤖 OptiTrade Bot started`);
  console.log(`📍 Listening on port ${PORT}`);
  console.log(`✅ Ready to receive webhooks\n`);
});
