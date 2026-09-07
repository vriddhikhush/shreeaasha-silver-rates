// Calibrated directly against live international spot: GSC Silver and Kalash Gold both
// displayed an identical SPOT($) ticker (gold 4431.00, silver 66.22, USD/INR 94.50) at the
// same moment as their RTGS/Market sell rates (2026-09-06) - synchronized baseline, no
// intermediate reference needed. Values are the average of both dealers - see server.py
// for the full derivation. Keep these in sync with server.py if you tune them.
const RTGS_SILVER_PCT = 19.97;
const MARKET_SILVER_PCT = 15.28;
const RTGS_GOLD_PCT = 17.26;
const MARKET_GOLD_PCT = 10.49;

const TROY_OZ_IN_GRAMS = 31.1034768;
const YAHOO_SPARK_URL = "https://query1.finance.yahoo.com/v7/finance/spark";
const YAHOO_SYMBOLS = "GC=F,SI=F,INR=X"; // gold futures, silver futures, USD/INR

async function fetchYahoo() {
  const url = `${YAHOO_SPARK_URL}?symbols=${encodeURIComponent(YAHOO_SYMBOLS)}&range=1d&interval=5m`;
  const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) throw new Error(`Yahoo Finance responded ${resp.status}`);
  const payload = await resp.json();
  const results = payload && payload.spark && payload.spark.result;
  if (!results || !results.length) throw new Error("Yahoo Finance returned no data");

  const bySymbol = {};
  for (const r of results) {
    const meta = r.response[0].meta;
    const price = meta.regularMarketPrice;
    bySymbol[r.symbol] = {
      price,
      low: meta.regularMarketDayLow != null ? meta.regularMarketDayLow : price,
      high: meta.regularMarketDayHigh != null ? meta.regularMarketDayHigh : price,
    };
  }

  for (const sym of ["GC=F", "SI=F", "INR=X"]) {
    if (!bySymbol[sym]) throw new Error(`Yahoo Finance response missing ${sym}`);
  }
  return bySymbol;
}

exports.handler = async function () {
  try {
    const raw = await fetchYahoo();
    const gold = raw["GC=F"];
    const silver = raw["SI=F"];
    const fx = raw["INR=X"];
    const inr = fx.price;

    const silverSpotPerKg = ((silver.price / TROY_OZ_IN_GRAMS) * 1000) * inr;
    const goldSpotPer10g = ((gold.price / TROY_OZ_IN_GRAMS) * 10) * inr;

    const round = (n) => Math.round(n);
    const round2 = (n) => Math.round(n * 100) / 100;
    const round4 = (n) => Math.round(n * 10000) / 10000;

    const body = {
      fetched_at: Math.floor(Date.now() / 1000),
      usd_inr: round4(inr),
      fx_range: [round4(fx.low), round4(fx.high)],
      gold: {
        usd_oz: round2(gold.price),
        usd_range: [round2(gold.low), round2(gold.high)],
        rtgs_per_10g: round(goldSpotPer10g * (1 + RTGS_GOLD_PCT / 100)),
        market_per_10g: round(goldSpotPer10g * (1 + MARKET_GOLD_PCT / 100)),
      },
      silver: {
        usd_oz: round2(silver.price),
        usd_range: [round2(silver.low), round2(silver.high)],
        rtgs_per_kg: round(silverSpotPerKg * (1 + RTGS_SILVER_PCT / 100)),
        market_per_kg: round(silverSpotPerKg * (1 + MARKET_SILVER_PCT / 100)),
      },
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
      body: JSON.stringify(body),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String((err && err.message) || err) }),
    };
  }
};
