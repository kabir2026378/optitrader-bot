const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

const COINBASE_API_URL = 'https://api.coinbase.com';
const COINBASE_API_KEY = process.env.COINBASE_API_KEY_NAME;
const COINBASE_PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY;
const SECURITY_KEY = process.env.SECURITY_KEY;

console.log(`\n✅ Bot with Ed25519 JWT\n`);

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function createJWT(path, method = 'GET') {
  if (!COINBASE_PRIVATE_KEY) throw new Error('COINBASE_PRIVATE_KEY not set');
  
  // Convert base64 Ed25519 key to PEM
  const keyBuffer = Buffer.from(COINBASE_PRIVATE_KEY, 'base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${keyBuffer.toString('base64').replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----`;
  
  const privateKey = crypto.createPrivateKey({
    key: pem,
    format: 'pem',
    type: 'pkcs8'
  });
  
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'EdDSA', typ: 'JWT', kid: COINBASE_API_KEY };
  const payload = {
    sub: COINBASE_API_KEY,
    iss: 'cdp_service',
    nbf: now,
    exp: now + 120,
    iat: now,
    uri: `${method} ${path}`
  };
  
  const headerEncoded = base64url(JSON.stringify(header));
  const payloadEncoded = base64url(JSON.stringify(payload));
  const message = `${headerEncoded}.${payloadEncoded}`;
  
  const signature = crypto.sign('ed25519', Buffer.from(message), privateKey);
  const signatureEncoded = base64url(signature);
  
  return `${message}.${signatureEncoded}`;
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
  const clientOrderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const orderData = { client_order_id: clientOrderId, product_id: symbol, side: action.toUpperCase(), order_configuration: { market_market_ioc: { quote_size: size.toString() } } };
  
  const token = createJWT('/api/v3/brokerage/orders', 'POST');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  
  const response = await axios.post(`${COINBASE_API_URL}/api/v3/brokerage/orders`, orderData, { headers });
  return response.data.success_response;
}

app.get('/', (req, res) => res.json({ status: 'OK' }));

app.get('/accounts', async (req, res) => {
  try {
    const token = createJWT('/api/v3/brokerage/accounts', 'GET');
    const response = await axios.get(`${COINBASE_API_URL}/api/v3/brokerage/accounts`, { headers: { 'Authorization': `Bearer ${token}` } });
    const balances = response.data.accounts.filter(acc => parseFloat(acc.available_balance.value) > 0);
    res.json({ success: true, balances: balances.map(acc => ({ currency: acc.currency, available: acc.available_balance.value })) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot on port ${PORT}`));
