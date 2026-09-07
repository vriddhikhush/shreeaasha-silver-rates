const POLL_MS = 30000;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const els = {
  dot: document.getElementById("dot"),
  statusText: document.getElementById("statusText"),
  banner: document.getElementById("banner"),
  spotGold: document.getElementById("spotGold"),
  spotSilver: document.getElementById("spotSilver"),
  spotFx: document.getElementById("spotFx"),
  rangeGold: document.getElementById("rangeGold"),
  rangeSilver: document.getElementById("rangeSilver"),
  rangeFx: document.getElementById("rangeFx"),
  silverRtgs: document.getElementById("silverRtgs"),
  silverMarket: document.getElementById("silverMarket"),
  goldRtgs: document.getElementById("goldRtgs"),
  goldMarket: document.getElementById("goldMarket"),
  updated: document.getElementById("updated"),
};

function fmt(n, maxFrac = 2) {
  if (n === undefined || n === null || Number.isNaN(n)) return "--";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: maxFrac });
}

function fmtInr(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return "--";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function render(data) {
  els.spotGold.textContent = fmt(data.gold.usd_oz);
  els.spotSilver.textContent = fmt(data.silver.usd_oz);
  els.spotFx.textContent = fmt(data.usd_inr, 3);

  els.rangeGold.textContent = `${fmt(data.gold.usd_range[0])} | ${fmt(data.gold.usd_range[1])}`;
  els.rangeSilver.textContent = `${fmt(data.silver.usd_range[0])} | ${fmt(data.silver.usd_range[1])}`;
  els.rangeFx.textContent = `${fmt(data.fx_range[0], 3)} | ${fmt(data.fx_range[1], 3)}`;

  els.silverRtgs.textContent = fmtInr(data.silver.rtgs_per_kg);
  els.silverMarket.textContent = fmtInr(data.silver.market_per_kg);
  els.goldRtgs.textContent = fmtInr(data.gold.rtgs_per_10g);
  els.goldMarket.textContent = fmtInr(data.gold.market_per_10g);

  const d = new Date(data.fetched_at * 1000);
  els.updated.textContent = "Last updated: " + d.toLocaleTimeString();

  if (data.warning) {
    els.banner.textContent = data.warning;
    els.banner.classList.remove("hidden");
  } else {
    els.banner.classList.add("hidden");
  }
}

async function poll() {
  try {
    const res = await fetch("/api/rates");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    els.dot.className = "dot live";
    els.statusText.textContent = "Live";
    render(data);
  } catch (err) {
    els.dot.className = "dot error";
    els.statusText.textContent = "Connection error";
    els.banner.textContent = "Could not reach the server: " + err.message;
    els.banner.classList.remove("hidden");
  }
}

poll();
setInterval(poll, POLL_MS);
