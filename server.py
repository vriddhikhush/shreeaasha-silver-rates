import html
import json
import os
import re
import threading
import time
from datetime import datetime

from flask import Flask, jsonify, send_from_directory
import requests
from dotenv import load_dotenv

load_dotenv()

REFRESH_SECONDS = int(os.getenv("REFRESH_SECONDS", "300"))

# Calibrated against two independent dealers on the same platform (GSC Silver + Kalash
# Gold, 2026-09-06), both anchored to IBJA Silver 999 (235456/kg) and Gold 999 (154884/10g):
#   Silver RTGS:  GSC 241301 (+2.48%)   | Kalash 241450 (+2.55%)
#   Silver Market: GSC 231500 (-1.68%)  | Kalash 232350 (-1.32%)
#   Gold RTGS:    GSC 157819 (+1.90%)   | Kalash 157913 (+1.96%)
#   Gold Market:  Kalash 148700-148800 (-3.93% to -3.99%) - GSC gave no figure
# GSC's numbers are used where available (it's the primary reference app); Gold Market
# has no GSC figure so it uses Kalash's. Expect dealer-to-dealer variation of a few
# tenths of a percent - retune in .env if you're matching a specific dealer exactly.
RTGS_SILVER_PCT = float(os.getenv("RTGS_SILVER_PCT", "2.48"))
MARKET_SILVER_PCT = float(os.getenv("MARKET_SILVER_PCT", "-1.68"))
RTGS_GOLD_PCT = float(os.getenv("RTGS_GOLD_PCT", "1.90"))
MARKET_GOLD_PCT = float(os.getenv("MARKET_GOLD_PCT", "-3.96"))

IBJA_URL = "https://www.ibjarates.com/"

app = Flask(__name__, static_folder="static", static_url_path="")

_cache_lock = threading.Lock()
_cache = {"data": None, "fetched_at": 0, "error": None}


def _extract_hidden_json(page_text, field_id):
    m = re.search(rf'id="{field_id}"\s+value="([^"]*)"', page_text)
    if not m:
        raise RuntimeError(f"IBJA page layout changed: {field_id} not found")
    return json.loads(html.unescape(m.group(1)))


def fetch_ibja():
    resp = requests.get(IBJA_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
    resp.raise_for_status()
    text = resp.text

    gold = _extract_hidden_json(text, "HdnGold")
    silver = _extract_hidden_json(text, "HdnSilver")

    if not gold.get("labels") or not silver.get("labels"):
        raise RuntimeError("IBJA published no rate history")

    date_str = gold["labels"][-1]  # DD/MM/YYYY
    as_of = datetime.strptime(date_str, "%d/%m/%Y").strftime("%d %b %Y")

    return {
        "as_of": as_of,
        "gold_999_per_10g": gold["purity999"][-1],
        "silver_999_per_kg": silver["silverRate"][-1],
    }


def build_snapshot():
    raw = fetch_ibja()
    gold_base = raw["gold_999_per_10g"]
    silver_base = raw["silver_999_per_kg"]

    return {
        "as_of": raw["as_of"],
        "fetched_at": int(time.time()),
        "gold": {
            "ibja_per_10g": gold_base,
            "rtgs_per_10g": round(gold_base * (1 + RTGS_GOLD_PCT / 100)),
            "market_per_10g": round(gold_base * (1 + MARKET_GOLD_PCT / 100)),
        },
        "silver": {
            "ibja_per_kg": silver_base,
            "rtgs_per_kg": round(silver_base * (1 + RTGS_SILVER_PCT / 100)),
            "market_per_kg": round(silver_base * (1 + MARKET_SILVER_PCT / 100)),
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
    # Debug off by default: Flask's debugger lets anyone who can reach this server run
    # arbitrary code from an error page - fine on localhost-only, not fine once a friend
    # (or the internet, via a tunnel) can reach it. Set FLASK_DEBUG=true in .env for local
    # development only.
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    # 0.0.0.0 so phones on the same Wi-Fi/LAN can reach it via this PC's local IP
    app.run(host="0.0.0.0", port=5050, debug=debug, use_reloader=False)
