const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

// ============================================
// COINBASE API SETUP
// ============================================

const COINBASE_API_URL = 'https://api.exchange.coinbase.com';

// Sign request for Coinbase API (required for all authenticated requests)
function signRequest(method, path, body = '') {
  const timestamp = Date.now() / 1000;
  const message = timestamp + method + path + (body ? body : '');
  
  const key = Buffer.from(process.env.COINBASE_API_SECRET, 'base64');
  const hmac = crypto.createHmac('sha256', key);
  const signature = hmac.update(message).digest('base64');

  return {
    'CB-ACCESS-KEY': process.env.COINBASE_API_KEY,
    'CB-ACCESS-SIGN': signature,
    'CB-ACCESS-TIMESTAMP': timestamp,
    'CB-ACCESS-PASSPHRASE': process.env.COINBASE_PASSPHRASE,
    'Content-Type': 'application/json'
  };
}

// ============================================
// HELPER: Get Current Market Price
// ============================================
async function getCurrentPrice(productId) {
  try {
    const response = await axios.get(`${COINBASE_API_URL}/products/${productId}/ticker`);
    return response.data.price;
  } catch (error) {
    console.error(`❌ Error fetching price for ${productId}:`, error.message);
    throw new Error(`Failed to fetch price for ${productId}`);
  }
}

// ============================================
// HELPER: Execute Trade on Coinbase
// ============================================
async function executeTrade(action, symbol, size) {
  try {
    const price = await getCurrentPrice(symbol);
    
    const orderData = {
      type: 'limit',
      side: action.toLowerCase(), // 'buy' or 'sell'
      product_id: symbol,         // 'XLM-USDC'
      size: size.toString(),
      price: price,
      time_in_force: 'IOC',       // Immediate or Cancel
      post_only: false
    };

    const path = '/orders';
    const body = JSON.stringify(orderData);
    const headers = signRequest('POST', path, body);

    console.log(`📤 Executing ${action.toUpperCase()} order:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Size: ${size}`);
    console.log(`   Price: ${price}`);

    const response = await axios.post(`${COINBASE_API_URL}${path}`, orderData, { headers });

    console.log(`✅ Order executed successfully!`);
    console.log(`   Order ID: ${response.data.id}`);
    console.log(`   Status: ${response.data.status}`);

    return {
      success: true,
      order_id: response.data.id,
      status: response.data.status,
      product_id: response.data.product_id,
      side: response.data.side,
      size: response.data.size,
      price: response.data.price,
      created_at: response.data.created_at
    };

  } catch (error) {
    console.error(`❌ Trade execution failed:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
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
      message: `Trade executed: ${action.toUpperCase()} ${size} ${symbol}`,
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
      has_passphrase: !!process.env.COINBASE_PASSPHRASE
    }
  });
});

// ============================================
// ACCOUNT INFO ENDPOINT (Debug)
// ============================================
app.get('/accounts', async (req, res) => {
  try {
    const path = '/accounts';
    const headers = signRequest('GET', path);
    
    const response = await axios.get(`${COINBASE_API_URL}${path}`, { headers });
    
    const balances = response.data.filter(acc => parseFloat(acc.available) > 0);
    
    res.json({
      success: true,
      balances: balances.map(acc => ({
        currency: acc.currency,
        available: acc.available,
        hold: acc.hold
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
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
