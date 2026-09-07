# Shree Aasha Silver Live Rates

A local/hosted web app showing silver and gold rates styled after Indian bullion-dealer apps
(GSC Silver, Ambica Spot, Kalash Gold): a live SPOT ticker plus RTGS/Market rate columns —
installable on your phone as a home-screen app (PWA). Deployed on both
[Render](https://shreeaasha-silver-rates.onrender.com) and
[Netlify](https://shreeaasha-silver-rates.netlify.app).

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Run the server — **no API key or signup needed**:
   ```bash
   python server.py
   ```
3. Open http://127.0.0.1:5050 on this PC.

## Data source: live international spot (no API key, no publish-schedule gaps)

An earlier version anchored to IBJA (India Bullion & Jewellers Association)'s official daily
rate. That's accurate, but IBJA only publishes once or twice a day on business days - so the
app could sit showing yesterday's (or Friday's) number for a long stretch, which felt broken
even though it was technically correct.

This version instead reads **live COMEX gold/silver futures + USD/INR** directly from Yahoo
Finance's public market-data endpoint (no key, no signup, no quota) and applies the **full
India retail markup directly against pure spot** - calibrated straight from real dealer data
(see below), no intermediate reference needed.

**On "live"**: this endpoint is free and unauthenticated, so it isn't tick-by-tick real-time -
checking Yahoo's own trade timestamps directly showed gold/silver refreshing roughly every
5-10 minutes and USD/INR sometimes 30-45 minutes. True sub-minute real-time market data is a
paid, licensed feed; nobody gives that away for free. The app polls every 30s, which is
frequent enough to pick up Yahoo's own updates promptly without wasting requests - polling
faster wouldn't get fresher data, since there's nothing new to fetch until Yahoo's side
changes. Numbers holding steady for several minutes at a stretch is expected, not broken.

**Why not pull from GSC Silver / Kalash Gold's own backend directly?** Their live rates come
through private streaming/trading infrastructure (`bcast.gscsilver.com`, `adminapi.gscsilver.com`,
Chirayusoft's dealer backend) - licensed B2B systems for paid bullion-trading platforms (note
the Login/Booking Desk/Trades/Pending Orders - these are dealer trading systems, not public
feeds). This app doesn't access that; everything here is computed independently from data
those apps already displayed publicly (their own on-screen SPOT ticker + RTGS/Market rates).

## RTGS / Market columns

Bullion trade uses two conventional rate types:
- **RTGS Rate** — for bank-transfer settlement (a premium over spot)
- **Market Rate** — the cash/counter rate (a smaller premium over spot)

Both are computed as `spot × (1 + markup%)`, calibrated from a single synchronized moment:
GSC Silver and Kalash Gold both displayed an **identical** SPOT($) ticker (gold 4431.00,
silver 66.22, USD/INR 94.50) at the same time as their RTGS/Market sell rates on 2026-09-06 -
so the spot baseline and the dealer numbers are from the exact same instant, no timing
mismatch. Constants in `.env` (average of both dealers where both had data):

| Constant | Default | GSC Silver | Kalash Gold |
|---|---|---|---|
| `RTGS_SILVER_PCT` | 19.97 | +19.94% | +20.01% |
| `MARKET_SILVER_PCT` | 15.28 | +15.06% | +15.49% |
| `RTGS_GOLD_PCT` | 17.26 | +17.23% | +17.30% |
| `MARKET_GOLD_PCT` | 10.49 | *(no figure given)* | +10.49% (only data point) |

If your dealer's actual rates drift from these over time, edit the percentages in `.env`
(or the constants at the top of `server.py` / `netlify/functions/rates.js` for the hosted
deployments) and redeploy - no other code changes needed.

## Two deployments, two codebases

Render runs the Python backend (`server.py`) as-is. Netlify can't run a persistent Python
server on its free tier, so `netlify/functions/rates.js` is a JavaScript reimplementation of
the same fetch + markup logic. **They must be kept in sync manually** - if you change the
markup constants, update both files.

## Using it on your phone

Two public links work from anywhere, no Wi-Fi requirement, even with your PC off:
- https://shreeaasha-silver-rates.onrender.com
- https://shreeaasha-silver-rates.netlify.app

Open either on your phone and use **"Add to Home Screen"** (Safari) or **"Install app"**
(Chrome) - it appears as its own icon, "Shree Aasha", and opens full-screen like a native app.

For local-network-only access (this PC's LAN IP, e.g. `http://192.168.1.5:5050`), Windows
Firewall may need to allow Python through: **Windows Security → Firewall & network
protection → Allow an app through firewall**.
