import os
import threading
import time

from flask import Flask, jsonify, send_from_directory
import requests
from dotenv import load_dotenv

load_dotenv()

REFRESH_SECONDS = int(os.getenv("REFRESH_SECONDS", "8"))
TROY_OZ_IN_GRAMS = 31.1034768

# Calibrated directly against live international spot: GSC Silver and Kalash Gold both
# displayed an identical SPOT($) ticker (gold 4431.00, silver 66.22, USD/INR 94.50) at the
# same moment as their RTGS/Market sell rates (2026-09-06), giving a synchronized baseline
# with no intermediate reference needed. Values below are the average of both dealers:
#   Silver RTGS:  GSC +19.94%  | Kalash +20.01%
#   Silver Market: GSC +15.06% | Kalash +15.49%
#   Gold RTGS:    GSC +17.23%  | Kalash +17.30%
#   Gold Market:  Kalash +10.49% (only data point available)
RTGS_SILVER_PCT = float(os.getenv("RTGS_SILVER_PCT", "19.97"))
MARKET_SILVER_PCT = float(os.getenv("MARKET_SILVER_PCT", "15.28"))
RTGS_GOLD_PCT = float(os.getenv("RTGS_GOLD_PCT", "17.26"))
MARKET_GOLD_PCT = float(os.getenv("MARKET_GOLD_PCT", "10.49"))

YAHOO_SPARK_URL = "https://query1.finance.yahoo.com/v7/finance/spark"
YAHOO_SYMBOLS = "GC=F,SI=F,INR=X"  # gold futures, silver futures, USD/INR

app = Flask(__name__, static_folder="static", static_url_path="")

_cache_lock = threading.Lock()
_cache = {"data": None, "fetched_at": 0, "error": None}


def fetch_yahoo():
    params = {"symbols": YAHOO_SYMBOLS, "range": "1d", "interval": "5m"}
    resp = requests.get(
        YAHOO_SPARK_URL, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=8
    )
    payload = resp.json()
    results = payload.get("spark", {}).get("result")
    if not results:
        raise RuntimeError("Yahoo Finance returned no data")

    by_symbol = {}
    for r in results:
        meta = r["response"][0]["meta"]
        price = meta["regularMarketPrice"]
        by_symbol[r["symbol"]] = {
            "price": price,
            "low": meta.get("regularMarketDayLow", price),
            "high": meta.get("regularMarketDayHigh", price),
        }

    for sym in ("GC=F", "SI=F", "INR=X"):
        if sym not in by_symbol:
            raise RuntimeError(f"Yahoo Finance response missing {sym}")

    return by_symbol


def build_snapshot():
    raw = fetch_yahoo()
    gold, silver, fx = raw["GC=F"], raw["SI=F"], raw["INR=X"]
    inr = fx["price"]

    silver_spot_per_kg = silver["price"] / TROY_OZ_IN_GRAMS * 1000 * inr
    gold_spot_per_10g = gold["price"] / TROY_OZ_IN_GRAMS * 10 * inr

    return {
        "fetched_at": int(time.time()),
        "usd_inr": round(inr, 4),
        "fx_range": [round(fx["low"], 4), round(fx["high"], 4)],
        "gold": {
            "usd_oz": round(gold["price"], 2),
            "usd_range": [round(gold["low"], 2), round(gold["high"], 2)],
            "rtgs_per_10g": round(gold_spot_per_10g * (1 + RTGS_GOLD_PCT / 100)),
            "market_per_10g": round(gold_spot_per_10g * (1 + MARKET_GOLD_PCT / 100)),
        },
        "silver": {
            "usd_oz": round(silver["price"], 2),
            "usd_range": [round(silver["low"], 2), round(silver["high"], 2)],
            "rtgs_per_kg": round(silver_spot_per_kg * (1 + RTGS_SILVER_PCT / 100)),
            "market_per_kg": round(silver_spot_per_kg * (1 + MARKET_SILVER_PCT / 100)),
        },
    }


def get_cached_snapshot():
    with _cache_lock:
        stale = (time.time() - _cache["fetched_at"]) > REFRESH_SECONDS
        if _cache["data"] is None or stale:
            try:
                _cache["data"] = build_snapshot()
                _cache["error"] = None
                _cache["fetched_at"] = time.time()
            except Exception as exc:
                _cache["error"] = str(exc)
                if _cache["data"] is None:
                    raise
        return _cache["data"], _cache["error"]


@app.route("/api/rates")
def api_rates():
    try:
        data, error = get_cached_snapshot()
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502

    resp = dict(data)
    if error:
        resp["warning"] = f"Using last known rates, refresh failed: {error}"
    return jsonify(resp)


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    # 0.0.0.0 so phones on the same Wi-Fi/LAN can reach it via this PC's local IP
    app.run(host="0.0.0.0", port=5050, debug=debug, use_reloader=False)
