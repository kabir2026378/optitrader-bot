const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

const COINBASE_API_URL = 'https://api.coinbase.com';
const COINBASE_API_KEY = process.env.COINBASE_API_KEY_NAME;
const COINBASE_PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY;
const SECURITY_KEY = process.env.SECURITY_KEY;

function createJWT(method, path) {
  let privateKey = COINBASE_PRIVATE_KEY.trim();
  if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const uri = `${method} api.coinbase.com${path}`;
  const payload = {sub: COINBASE_API_KEY, iss: 'cdp', nbf: now, exp: now + 120, iat: now, uri: uri};
  const headers = {kid: COINBASE_API_KEY, nonce: crypto.randomBytes(16).toString('hex')};
  return jwt.sign(payload, privateKey, {algorithm: 'ES256', header: headers});
}

app.post('/webhook', async (req, res) => {
  try {
    const {action, symbol, size, security_key} = req.body;
    if (!security_key || security_key !== SECURITY_KEY) return res.status(401).json({success: false, error: 'Unauthorized'});
    if (!action || !symbol || !size) return res.status(400).json({success: false, error: 'Missing fields'});
    if (!['buy','sell'].includes(action.toLowerCase())) return res.status(400).json({success: false, error: 'Invalid action'});
    
    const clientOrderId = `order-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
    const token = createJWT('POST', '/api/v3/brokerage/orders');
    
    const orderConfig = action.toLowerCase() === 'buy' 
      ? {market_market_ioc: {quote_size: size.toString()}}
      : {market_market_ioc: {base_size: size.toString()}};
    
    const orderBody = {
      client_order_id: clientOrderId,
      product_id: symbol,
      side: action.toUpperCase(),
      order_configuration: orderConfig
    };
    
    const response = await axios.post(`${COINBASE_API_URL}/api/v3/brokerage/orders`, orderBody, {headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}});
    return res.status(200).json({success: true, order: response.data.success_response});
  } catch (error) {
    return res.status(500).json({success: false, error: error.message});
  }
});

app.get('/', (req, res) => res.json({status: 'OK'}));

app.get('/accounts', async (req, res) => {
  try {
    const token = createJWT('GET', '/api/v3/brokerage/accounts');
    const response = await axios.get(`${COINBASE_API_URL}/api/v3/brokerage/accounts`, {headers: {'Authorization': `Bearer ${token}`}});
    const balances = response.data.accounts.filter(acc => parseFloat(acc.available_balance.value) > 0);
    res.json({success: true, balances: balances.map(acc => ({currency: acc.currency, available: acc.available_balance.value}))});
  } catch (error) {
    res.status(500).json({success: false, error: error.message});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot on port ${PORT}`));
