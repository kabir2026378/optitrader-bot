# OptiTrade Automated Trading Bot

Automated trading bot that receives signals from **OptiTrade Pine Script** (TradingView) via webhook and executes trades on **Coinbase Exchange** using the official Coinbase API.

## 🎯 How It Works

```
TradingView OptiTrade
       ↓
   Webhook Alert
       ↓
Railway Express Server
       ↓
Coinbase API
       ↓
Trade Executed (XLM-USDC)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Coinbase Exchange account
- TradingView account with OptiTrade strategy
- Railway account (railway.app)
- GitHub account

### Installation

1. **Clone or download this repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/optitrader-bot.git
   cd optitrader-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Coinbase API credentials and security key
   ```

4. **Run locally** (optional for testing)
   ```bash
   npm run dev
   ```
   Bot will listen on `http://localhost:3000`

5. **Deploy to Railway** (follow `RAILWAY_SETUP.md`)

## 📋 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SECURITY_KEY` | Secret key matching OptiTrade webhook | ✅ Yes |
| `COINBASE_API_KEY` | Coinbase API key | ✅ Yes |
| `COINBASE_API_SECRET` | Coinbase API secret | ✅ Yes |
| `COINBASE_PASSPHRASE` | Coinbase passphrase | ✅ Yes |
| `PORT` | Server port (default: 3000) | ❌ No |

## 🔌 API Endpoints

### POST `/webhook`
Receives signal from OptiTrade and executes trade.

**Request:**
```json
{
  "action": "buy",
  "symbol": "XLM-USDC",
  "size": 2,
  "security_key": "your-security-key"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Trade executed: BUY 2 XLM-USDC",
  "order": {
    "order_id": "12345-abc",
    "status": "pending",
    "side": "buy",
    "size": "2",
    "price": "0.1245"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Insufficient balance"
}
```

### GET `/`
Health check endpoint.

**Response:**
```json
{
  "status": "✅ Trading bot is running",
  "timestamp": "2024-06-22T14:32:15.000Z",
  "environment": {
    "has_security_key": true,
    "has_coinbase_api_key": true,
    "has_coinbase_secret": true,
    "has_passphrase": true
  }
}
```

### GET `/accounts`
Get Coinbase account balances.

**Response:**
```json
{
  "success": true,
  "balances": [
    {
      "currency": "XLM",
      "available": "1000.50",
      "hold": "0"
    },
    {
      "currency": "USDC",
      "available": "500.00",
      "hold": "0"
    }
  ]
}
```

## 🔐 Security

- ✅ All API requests signed with HMAC-SHA256
- ✅ Security key validation on every webhook
- ✅ Environment variables stored securely in Railway
- ✅ API secrets never logged
- ✅ Coinbase API credentials encrypted in transit

## 📊 Trading Parameters

**Current Configuration:**
- Pair: `XLM-USDC`
- Trade Size: `$2` (fixed)
- Order Type: `Limit` with IOC (Immediate or Cancel)
- Strategy: OptiTrade (EMA + RSI + Bollinger Bands + MACD)

## 🛠️ Troubleshooting

**"No response from webhook?"**
- Check Railway environment variables are set
- Verify deployment is active (Railway → Deployments → ✅)
- Check logs for errors (Railway → Logs)

**"Order failed on Coinbase?"**
- Verify you have XLM and USDC balance
- Check symbol is exactly `XLM-USDC`
- Ensure API credentials are correct

**"401 Unauthorized?"**
- Security key in OptiTrade alert doesn't match Railway variable
- Make sure `SECURITY_KEY` env var is set

**"502 Bad Gateway?"**
- Environment variables disappeared after redeploy
- Re-add all 4 variables and save (triggers redeploy)

See `RAILWAY_SETUP.md` for detailed troubleshooting.

## 📝 Logs

Railway logs show every webhook:
```
🔔 Webhook received at 2024-06-22T14:32:15.000Z
   Body: {"action":"buy","symbol":"XLM-USDC","size":2,...}
📤 Executing BUY order:
   Symbol: XLM-USDC
   Size: 2
   Price: 0.1245
✅ Order executed successfully!
   Order ID: f1c2a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b
   Status: pending
```

## 🎓 Learning Resources

- [Coinbase Exchange API Docs](https://docs.cloud.coinbase.com/exchange-rest-api)
- [TradingView Webhook Alerts](https://www.tradingview.com/blog/en/tradingview-alerts-via-webhook/)
- [Railway Docs](https://docs.railway.app)

## ⚠️ Disclaimer

This bot trades real money. Use with caution:
- Start with small trade sizes ($2)
- Test on paper/demo account first
- Monitor trades manually initially
- Understand OptiTrade strategy before enabling

## 📞 Support

Check Railway logs first — they show exact error messages and help debug issues quickly.

---

**Ready to deploy?** Follow `RAILWAY_SETUP.md` step-by-step.
