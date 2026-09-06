const POLL_MS = 15000;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const els = {
  dot: document.getElementById("dot"),
  statusText: document.getElementById("statusText"),
  banner: document.getElementById("banner"),
  ibjaGold: document.getElementById("ibjaGold"),
  ibjaSilver: document.getElementById("ibjaSilver"),
  asOf: document.getElementById("asOf"),
  silverRtgs: document.getElementById("silverRtgs"),
  silverMarket: document.getElementById("silverMarket"),
  goldRtgs: document.getElementById("goldRtgs"),
  goldMarket: document.getElementById("goldMarket"),
  updated: document.getElementById("updated"),
};

function fmt(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return "--";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function render(data) {
  els.ibjaGold.textContent = fmt(data.gold.ibja_per_10g);
  els.ibjaSilver.textContent = fmt(data.silver.ibja_per_kg);
  els.asOf.textContent = "IBJA reference as of " + data.as_of;

  els.silverRtgs.textContent = fmt(data.silver.rtgs_per_kg);
  els.silverMarket.textContent = fmt(data.silver.market_per_kg);
  els.goldRtgs.textContent = fmt(data.gold.rtgs_per_10g);
  els.goldMarket.textContent = fmt(data.gold.market_per_10g);

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
