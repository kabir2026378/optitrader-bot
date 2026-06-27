const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

// ============================================
// COINBASE ADVANCED TRADE API SETUP (JWT Auth)
// ============================================

const COINBASE_API_URL = 'https://api.coinbase.com';
const COINBASE_API_KEY = process.env.COINBASE_API_KEY_NAME;
const COINBASE_PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY;

console.log(`\n🔑 API Configuration:`);
console.log(`   API Key set: ${!!COINBASE_API_KEY}`);
console.log(`   Private Key set: ${!!COINBASE_PRIVATE_KEY}`);
console.log(`   Security Key set: ${!!process.env.SECURITY_KEY}`);
console.log(`   Using JWT Authentication\n`);

// Create JWT token for Advanced Trade API authentication
function createJWT(path, method = 'GET') {
  if (!COINBASE_PRIVATE_KEY) {
    throw new Error('COINBASE_API_SECRET (Private Key) is not set!');
  }
  
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 120; // Token valid for 2 minutes

  const payload = {
    sub: COINBASE_API_KEY,
    iss: 'cdp_service',
    nbf: now,
    exp: expiresAt,
    iat: now,
    uri: `${method} ${path}`
  };

  try {
    const token = jwt.sign(payload, COINBASE_PRIVATE_KEY, { algorithm: 'ES256' });
    return token;
  } catch (error) {
    console.error('❌ JWT signing failed:', error.message);
    throw new Error(`Failed to create JWT: ${error.message}`);
  }
}

// Get authorization header for API requests
function getAuthHeaders(path, method = 'GET') {
  const token = createJWT(path, method);
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// ============================================
// WEBHOOK ENDPOINT (OptiTrade sends signals here)
// ============================================
app.post('/webhook', async (req, res) => {
  try {
    const { action, symbol, size, security_key } = req.body;

    console.log(`\n🔔 Webhook received at ${new Date().toISOString()}`);
    console.log(`   Body:`, JSON.stringify(req.body));

    // ✅ Step 1: Validate Security Key
    if (!security_key || security_key !== process.env.SECURITY_KEY) {
      console.warn(`⚠️ Unauthorized webhook attempt`);
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized: Invalid security key' 
      });
    }

    // ✅ Step 2: Validate Required Fields
    if (!action || !symbol || !size) {
      console.warn(`⚠️ Missing required fields:`, { action, symbol, size });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: action, symbol, size' 
      });
    }

    // ✅ Step 3: Validate Action
    if (!['buy', 'sell'].includes(action.toLowerCase())) {
      console.warn(`⚠️ Invalid action:`, action);
      return res.status(400).json({ 
        success: false, 
        error: 'Action must be "buy" or "sell"' 
      });
    }

    // ✅ Step 4: Execute Trade
    const tradeResult = await executeTrade(action, symbol, size);

    // ✅ Step 5: Log and Respond
    console.log(`\n✅ Trade request completed successfully\n`);

    return res.status(200).json({
      success: true,
      message: `Trade executed: ${action.toUpperCase()} $${size} ${symbol}`,
      order: tradeResult
    });

  } catch (error) {
    console.error(`\n❌ Error processing webhook:`, error.message);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// HELPER: Execute Trade on Coinbase
// ============================================
async function executeTrade(action, symbol, size) {
  try {
    // Generate unique client order ID
    const clientOrderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Market order format for Advanced Trade API
    const orderData = {
      client_order_id: clientOrderId,
      product_id: symbol,           // 'XLM-USD'
      side: action.toUpperCase(),   // 'BUY' or 'SELL'
      order_configuration: {
        market_market_ioc: {
          quote_size: size.toString()  // Dollar amount to spend
        }
      }
    };

    const path = '/api/v3/brokerage/orders';
    const body = JSON.stringify(orderData);
    const headers = getAuthHeaders(path, 'POST');

    console.log(`📤 Executing ${action.toUpperCase()} market order:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Amount: $${size}`);
    console.log(`   Order ID: ${clientOrderId}`);

    const response = await axios.post(`${COINBASE_API_URL}${path}`, orderData, { headers });

    console.log(`✅ Order executed successfully!`);
    console.log(`   Order ID: ${response.data.success_response.order_id}`);
    console.log(`   Status: ${response.data.success_response.status || 'pending'}`);
    console.log(`   Product: ${response.data.success_response.product_id}`);

    return {
      success: true,
      order_id: response.data.success_response.order_id,
      status: response.data.success_response.status || 'pending',
      product_id: response.data.success_response.product_id,
      side: response.data.success_response.side,
      client_order_id: response.data.success_response.client_order_id
    };

  } catch (error) {
    console.error(`❌ Trade execution failed:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ Trading bot is running',
    timestamp: new Date().toISOString(),
    environment: {
      has_security_key: !!process.env.SECURITY_KEY,
      has_coinbase_api_key: !!process.env.COINBASE_API_KEY,
      has_coinbase_secret: !!process.env.COINBASE_API_SECRET,
      auth_method: 'JWT (Advanced Trade API)'
    }
  });
});

// ============================================
// ACCOUNT INFO ENDPOINT (Debug)
// ============================================
app.get('/accounts', async (req, res) => {
  try {
    const path = '/api/v3/brokerage/accounts';
    const headers = getAuthHeaders(path, 'GET');
    
    const response = await axios.get(`${COINBASE_API_URL}${path}`, { headers });
    
    const balances = response.data.accounts.filter(acc => parseFloat(acc.available_balance.value) > 0);
    
    res.json({
      success: true,
      balances: balances.map(acc => ({
        currency: acc.currency,
        available: acc.available_balance.value,
        hold: acc.hold.value
      }))
    });
  } catch (error) {
    console.error('❌ /accounts error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.message || error.message 
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🤖 OptiTrade Bot started`);
  console.log(`📍 Listening on port ${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`✅ Health check: http://localhost:${PORT}/\n`);
});