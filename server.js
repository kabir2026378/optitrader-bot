const express = require('express');
const { Coinbase } = require('@coinbase/coinbase-sdk');
require('dotenv').config();

const app = express();
app.use(express.json());

const COINBASE_API_KEY = process.env.COINBASE_API_KEY_NAME;
const COINBASE_PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY;
const SECURITY_KEY = process.env.SECURITY_KEY;

console.log(`\n✅ Bot with @coinbase/coinbase-sdk\n`);

const client = Coinbase.configureFromJson({
  apiKeyName: COINBASE_API_KEY,
  privateKey: COINBASE_PRIVATE_KEY
});

app.post('/webhook', async (req, res) => {
  try {
    const { action, symbol, size, security_key } = req.body;
    if (!security_key || security_key !== SECURITY_KEY) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!action || !symbol || !size) return res.status(400).json({ success: false, error: 'Missing fields' });
    if (!['buy', 'sell'].includes(action.toLowerCase())) return res.status(400).json({ success: false, error: 'Invalid action' });
    
    const order = await client.orders.createOrder({
      product_id: symbol,
      side: action.toUpperCase(),
      order_configuration: { market_market_ioc: { quote_size: size.toString() } }
    });
    
    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'OK' }));

app.get('/accounts', async (req, res) => {
  try {
    const accounts = await client.accounts.listAccounts();
    const balances = accounts.filter(acc => acc.availableBalance?.value > 0);
    res.json({ success: true, balances: balances.map(acc => ({ 
      currency: acc.currency, 
      available: acc.availableBalance?.value 
    })) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot on port ${PORT}`));
