# OptiTrade Bot - Railway Deployment Guide

## Step 1: Get Coinbase API Credentials

1. Log in to [Coinbase Exchange](https://exchange.coinbase.com/)
2. Go to **Settings → API** (top right)
3. Click **Create API Key**
4. **Permissions needed:**
   - ✅ View (read)
   - ✅ Trade (to place orders)
   - ✅ Transfer (optional, for withdrawals)
5. Copy these 3 values:
   - `API Key` → `COINBASE_API_KEY`
   - `API Secret` → `COINBASE_API_SECRET`
   - `Passphrase` → `COINBASE_PASSPHRASE`

⚠️ **Save the secret immediately** — you can't see it again!

---

## Step 2: Create Security Key

Choose a random secret string for `SECURITY_KEY` (example):
```
SECURITY_KEY = xKj9$mP2nQ#vL8wR4bY7x
```

You'll use this in OptiTrade alerts.

---

## Step 3: Push Code to GitHub

1. Create a new GitHub repo: `optitrader-bot`
2. Push the 3 files:
   ```bash
   git init
   git add .
   git commit -m "Initial optitrader bot setup"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/optitrader-bot.git
   git push -u origin main
   ```

---

## Step 4: Deploy to Railway

### Option A: Railway Dashboard (Easiest)

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click **+ New Project**
4. Select **Deploy from GitHub repo**
5. Choose your `optitrader-bot` repo
6. Click **Deploy**
7. Wait for deployment to complete (~1-2 min)

### Option B: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway init

# Deploy
railway up
```

---

## Step 5: Add Environment Variables to Railway

1. Go to your Railway project dashboard
2. Click **Variables** tab
3. Add these 4 variables:

| Name | Value | Source |
|------|-------|--------|
| `SECURITY_KEY` | `xKj9$mP2nQ#vL8wR4bY7x` | Your secret from Step 2 |
| `COINBASE_API_KEY` | Your API key | From Coinbase Step 1 |
| `COINBASE_API_SECRET` | Your API secret | From Coinbase Step 1 |
| `COINBASE_PASSPHRASE` | Your passphrase | From Coinbase Step 1 |

4. Click **Save**
5. Railway will **auto-redeploy** with the new variables

---

## Step 6: Get Your Railway URL

1. In Railway dashboard, find your service
2. Click **Deployments** tab
3. Find the **Domain** (looks like):
   ```
   https://optitrader-bot-production-xxxx.up.railway.app
   ```
4. Copy this — this is your webhook URL!

---

## Step 7: Test the Bot

### Test 1: Health Check
Open this in your browser:
```
https://optitrader-bot-production-xxxx.up.railway.app/
```

You should see:
```json
{
  "status": "✅ Trading bot is running",
  "environment": {
    "has_security_key": true,
    "has_coinbase_api_key": true,
    "has_coinbase_secret": true,
    "has_passphrase": true
  }
}
```

### Test 2: Check Balances
```
https://optitrader-bot-production-xxxx.up.railway.app/accounts
```

Should show your Coinbase balances.

### Test 3: Manual Webhook Test (curl)

```bash
curl -X POST https://optitrader-bot-production-xxxx.up.railway.app/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "buy",
    "symbol": "XLM-USDC",
    "size": 2,
    "security_key": "xKj9$mP2nQ#vL8wR4bY7x"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Trade executed: BUY 2 XLM-USDC",
  "order": {
    "order_id": "12345-67890",
    "status": "pending",
    "side": "buy",
    "size": "2"
  }
}
```

---

## Step 8: Configure OptiTrade Alert

In your OptiTrade Pine Script (TradingView):

1. Open **Create Alert**
2. **Alert Name:** `OptiTrade Signal`
3. **Condition:** Your OptiTrade strategy
4. **Action:** Select **Webhook URL**
5. **Webhook URL:**
   ```
   https://optitrader-bot-production-xxxx.up.railway.app/webhook
   ```
6. **Message:**
   ```json
   {
     "action": "{{strategy.order.action}}",
     "symbol": "XLM-USDC",
     "size": 2,
     "security_key": "xKj9$mP2nQ#vL8wR4bY7x"
   }
   ```
7. Click **Create Alert**

---

## Step 9: Monitor Logs

1. Railway Dashboard → **Deployments**
2. Click the **most recent deployment**
3. **Logs** tab shows:
   - Webhook received
   - Trade executed
   - Errors (if any)

Example log:
```
🔔 Webhook received at 2024-06-22T14:32:15.000Z
   Body: {"action":"buy","symbol":"XLM-USDC",...}
📤 Executing BUY order:
   Symbol: XLM-USDC
   Size: 2
   Price: 0.1245
✅ Order executed successfully!
   Order ID: f1c2a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b
```

---

## Troubleshooting

### ❌ 502 Bad Gateway
**Cause:** Environment variables not set or server crashed
**Fix:** 
1. Go to Railway → **Variables**
2. Re-add all 4 environment variables
3. Click **Save** (triggers auto-redeploy)

### ❌ 401 Unauthorized
**Cause:** Wrong security key in webhook message
**Fix:** 
- Check your OptiTrade alert message has correct `security_key`
- Verify it matches Railway variable `SECURITY_KEY`

### ❌ Order Failed Error
**Cause:** Insufficient balance, invalid symbol, or API credentials wrong
**Fix:**
1. Check Coinbase balance (has XLM and USDC?)
2. Verify symbol is exactly `XLM-USDC`
3. Test Coinbase API credentials in [Coinbase API docs](https://docs.cloud.coinbase.com/exchange-rest-api/reference/)

### ❌ No response from webhook
**Cause:** Railway deployment not complete or IPv6 disabled
**Fix:**
1. Check deployment status in Railway → **Deployments** (should show ✅ "Active")
2. Go to **Settings** → **Networking** → Enable **IPv6** if disabled

---

## Safety Tips

⚠️ **Before going live:**

1. **Test with small amounts** ($2 trade size is good)
2. **Enable Coinbase IP whitelist** (Coinbase Settings → API → IP Whitelist)
3. **Check OptiTrade strategy logic** — don't trade unless EMA, RSI, Bollinger Bands, AND MACD all align
4. **Monitor first trades manually** in Coinbase dashboard
5. **Set a daily trading limit** if possible (Coinbase account limits)

---

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Add environment variables
3. ✅ Test health check endpoint
4. ✅ Configure OptiTrade alert
5. ✅ Monitor logs on first trade
6. ✅ Go live!

Need help? Check Railway logs first — they tell you exactly what went wrong!
