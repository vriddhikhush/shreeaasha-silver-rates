// Calibrated against two independent dealers on the same platform (GSC Silver + Kalash
// Gold, 2026-09-06), both anchored to IBJA Silver 999 and Gold 999 - see server.py / README
// for the full derivation. Keep these in sync with server.py if you tune them.
const RTGS_SILVER_PCT = 2.48;
const MARKET_SILVER_PCT = -1.68;
const RTGS_GOLD_PCT = 1.9;
const MARKET_GOLD_PCT = -3.96;

function unescapeHtml(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractHiddenJson(text, fieldId) {
  const re = new RegExp(`id="${fieldId}"\\s+value="([^"]*)"`);
  const m = text.match(re);
  if (!m) throw new Error(`IBJA page layout changed: ${fieldId} not found`);
  return JSON.parse(unescapeHtml(m[1]));
}

async function fetchIbja() {
  const resp = await fetch("https://www.ibjarates.com/", {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!resp.ok) throw new Error(`IBJA responded ${resp.status}`);
  const text = await resp.text();

  const gold = extractHiddenJson(text, "HdnGold");
  const silver = extractHiddenJson(text, "HdnSilver");

  if (!gold.labels || !gold.labels.length || !silver.silverRate || !silver.silverRate.length) {
    throw new Error("IBJA published no rate history");
  }

  const dateStr = gold.labels[gold.labels.length - 1]; // DD/MM/YYYY
  const [dd, mm, yyyy] = dateStr.split("/");
  const asOf = new Date(Date.UTC(+yyyy, +mm - 1, +dd)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return {
    as_of: asOf,
    gold_999_per_10g: gold.purity999[gold.purity999.length - 1],
    silver_999_per_kg: silver.silverRate[silver.silverRate.length - 1],
  };
}

exports.handler = async function () {
  try {
    const raw = await fetchIbja();
    const goldBase = raw.gold_999_per_10g;
    const silverBase = raw.silver_999_per_kg;

    const body = {
      as_of: raw.as_of,
      fetched_at: Math.floor(Date.now() / 1000),
      gold: {
        ibja_per_10g: goldBase,
        rtgs_per_10g: Math.round(goldBase * (1 + RTGS_GOLD_PCT / 100)),
        market_per_10g: Math.round(goldBase * (1 + MARKET_GOLD_PCT / 100)),
      },
      silver: {
        ibja_per_kg: silverBase,
        rtgs_per_kg: Math.round(silverBase * (1 + RTGS_SILVER_PCT / 100)),
        market_per_kg: Math.round(silverBase * (1 + MARKET_SILVER_PCT / 100)),
      },
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120",
      },
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
