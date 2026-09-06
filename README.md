# Shree Aasha Silver Live Rates

A local web app showing silver and gold rates styled after Indian bullion-dealer apps (GSC
Silver, Ambica Spot, Kalash Gold): an IBJA reference ticker plus RTGS/Market rate columns —
installable on your phone as a home-screen app (PWA).

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

## Data source: IBJA (no API key, no quota, no private scraping)

Earlier versions guessed India retail prices from international COMEX futures + an assumed
import-duty/GST markup. That was only ever an approximation. This version instead reads the
**India Bullion & Jewellers Association (IBJA)** daily published rate — the actual official
industry benchmark for Indian gold/silver prices (the same reference dealers themselves use),
publicly available at [ibjarates.com](https://www.ibjarates.com/), not gated behind any login.

IBJA publishes once or twice a day on business days (no weekend/holiday updates — that's the
real market convention, not a limitation of this app), so the server re-fetches it every
`REFRESH_SECONDS` (default 5 min — no point checking more often than the source changes) and
carries forward the last published value until a new one appears.

**Why not scrape GSC Silver's own live number directly?** Their live rates come through a
private streaming/trading backend (`bcast.gscsilver.com`, `adminapi.gscsilver.com`, custom
ports) — licensed B2B infrastructure for their bullion-trading platform (note the Login/
Booking Desk/Trades/Pending Orders on their site — it's a dealer trading system, not a public
feed). Continuously polling that isn't appropriate. IBJA is the legitimate public alternative.

## RTGS / Market columns

Bullion trade uses two conventional rate types:
- **RTGS Rate** — for bank-transfer settlement (a small premium over the base reference)
- **Market Rate** — the cash/counter rate (typically at a discount to RTGS)

Both are computed as `IBJA rate × (1 + spread%)`, with spread constants in `.env`, cross-checked
against **two independent dealers on the same underlying platform** (GSC Silver and Kalash
Gold, both Mysuru-based, both showing identical SPOT($) numbers — confirming a shared upstream
feed with each dealer setting their own margin on top):

| Constant | Default | GSC Silver | Kalash Gold |
|---|---|---|---|
| `RTGS_SILVER_PCT` | 2.48 | +2.48% (241301) | +2.55% (241450) |
| `MARKET_SILVER_PCT` | -1.68 | -1.68% (231500) | -1.32% (232350) |
| `RTGS_GOLD_PCT` | 1.90 | +1.90% (157819) | +1.96% (157913) |
| `MARKET_GOLD_PCT` | -3.96 | *(no figure given)* | -3.93% to -3.99% (148700/148800) |

The two dealers agree within a few tenths of a percent on RTGS/Market-silver/RTGS-gold —
that consistency is what makes these defaults trustworthy. Gold's Market rate only has one
real data point (Kalash) since GSC never published one; expect it to need retuning more than
the others. If your dealer's actual rates drift from these over time, just edit the
percentages in `.env` and restart — no code changes needed.

## Using it on your phone

The server binds to your PC's network, so a phone on the **same Wi-Fi** can reach it:

1. On your phone's browser, go to `http://<this-PC's-LAN-IP>:5050` — e.g. `http://192.168.1.5:5050`
   (find your PC's IP with `ipconfig`; it can change if your router reassigns it).
2. If it doesn't load, Windows Firewall may be blocking inbound connections to port 5050 —
   allow it yourself: **Windows Security → Firewall & network protection → Allow an app
   through firewall**, and allow Python (or the prompt Windows shows on first run).
3. Use your browser's **"Add to Home Screen"** (Safari) or **"Install app"** (Chrome) — it'll
   appear as its own icon, "Shree Aasha", and open full-screen like a native app.
