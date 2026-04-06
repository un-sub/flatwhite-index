import { useState, useEffect } from "react";

const SUPABASE_URL = "https://fhcxythnjadmscqlpzgx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mHNJsNq7iXHD80PRCwsKmg_2v5i8-gq";

const query = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "",
    },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const SUBURBS = [
  "Abbotsford", "Albert Park", "Armadale", "Balwyn", "Brunswick",
  "Camberwell", "Carlton", "CBD", "Clifton Hill", "Coburg",
  "Collingwood", "Cremorne", "Docklands", "Elwood", "Essendon",
  "Fitzroy", "Flemington", "Footscray", "Glen Iris", "Hawthorn",
  "Kensington", "Kew", "Malvern", "Middle Park", "Moonee Ponds",
  "Newport", "Northcote", "Parkville", "Port Melbourne", "Prahran",
  "Preston", "Richmond", "South Melbourne", "South Yarra", "St Kilda",
  "Surrey Hills", "Thornbury", "Toorak", "Williamstown", "Windsor", "Yarraville"
];

// Approximate lat/lng centre of each suburb for Overpass API queries
const SUBURB_LATLNG = {
  "Abbotsford":      [-37.803, 144.999],
  "Albert Park":     [-37.844, 144.955],
  "Armadale":        [-37.857, 145.018],
  "Balwyn":          [-37.808, 145.084],
  "Brunswick":       [-37.775, 144.963],
  "Camberwell":      [-37.838, 145.059],
  "Carlton":         [-37.801, 144.970],
  "CBD":             [-37.813, 145.000],
  "Clifton Hill":    [-37.787, 144.997],
  "Coburg":          [-37.748, 144.966],
  "Collingwood":     [-37.795, 144.987],
  "Cremorne":        [-37.830, 144.996],
  "Docklands":       [-37.814, 144.947],
  "Elwood":          [-37.879, 144.989],
  "Essendon":        [-37.749, 144.924],
  "Fitzroy":         [-37.797, 144.979],
  "Flemington":      [-37.794, 144.936],
  "Footscray":       [-37.800, 144.900],
  "Glen Iris":       [-37.858, 145.050],
  "Hawthorn":        [-37.823, 145.039],
  "Kensington":      [-37.797, 144.929],
  "Kew":             [-37.804, 145.032],
  "Malvern":         [-37.856, 145.039],
  "Middle Park":     [-37.854, 144.959],
  "Moonee Ponds":    [-37.768, 144.927],
  "Newport":         [-37.843, 144.885],
  "Northcote":       [-37.772, 145.011],
  "Parkville":       [-37.789, 144.958],
  "Port Melbourne":  [-37.836, 144.936],
  "Prahran":         [-37.850, 144.993],
  "Preston":         [-37.748, 145.009],
  "Richmond":        [-37.822, 145.000],
  "South Melbourne": [-37.834, 144.969],
  "South Yarra":     [-37.839, 144.994],
  "St Kilda":        [-37.867, 144.982],
  "Surrey Hills":    [-37.824, 145.100],
  "Thornbury":       [-37.761, 145.011],
  "Toorak":          [-37.843, 145.014],
  "Williamstown":    [-37.860, 144.898],
  "Windsor":         [-37.857, 144.993],
  "Yarraville":      [-37.816, 144.882],
};

const formatPrice = (p) => `$${Number(p).toFixed(2)}`;

const getSuburbAverages = (entries) => {
  const map = {};
  entries.forEach(e => {
    if (!map[e.suburb]) map[e.suburb] = [];
    map[e.suburb].push(Number(e.price));
  });
  return Object.entries(map).map(([suburb, prices]) => ({
    suburb,
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    count: prices.length
  })).sort((a, b) => a.avg - b.avg);
};

const getSuburbCafes = (entries, suburb) => {
  const map = {};
  entries.filter(e => e.suburb === suburb).forEach(e => {
    if (!map[e.cafe]) map[e.cafe] = [];
    map[e.cafe].push({ price: Number(e.price), type: e.type, date: e.date, address: e.address });
  });
  return Object.entries(map).map(([cafe, items]) => ({
    cafe,
    avg: items.reduce((a, b) => a + b.price, 0) / items.length,
    count: items.length,
    items: items.sort((a, b) => new Date(b.date) - new Date(a.date))
  })).sort((a, b) => a.avg - b.avg);
};

const getPriceColor = (price, min, max) => {
  const t = max === min ? 0.5 : (price - min) / (max - min);
  if (t < 0.33) return "#3aaa6a";
  if (t < 0.66) return "#d4a030";
  return "#e05050";
};

const getPriceBg = (price, min, max) => {
  const t = max === min ? 0.5 : (price - min) / (max - min);
  if (t < 0.33) return "rgba(58,170,106,0.1)";
  if (t < 0.66) return "rgba(212,160,48,0.1)";
  return "rgba(224,80,80,0.1)";
};

// Approximate geographic positions in a 460x410 SVG viewBox
const SUBURB_POSITIONS = {
  "Williamstown":    [60,  376],
  "Newport":         [100, 348],
  "Yarraville":      [118, 308],
  "Footscray":       [152, 274],
  "Essendon":        [134, 160],
  "Moonee Ponds":    [168, 198],
  "Docklands":       [198, 242],
  "CBD":             [236, 238],
  "Port Melbourne":  [180, 312],
  "South Melbourne": [214, 284],
  "St Kilda":        [222, 350],
  "Carlton":         [240, 198],
  "Brunswick":       [228, 166],
  "Coburg":          [216, 132],
  "Fitzroy":         [268, 206],
  "Northcote":       [292, 174],
  "Thornbury":       [298, 146],
  "Collingwood":     [292, 220],
  "Abbotsford":      [318, 216],
  "Richmond":        [296, 248],
  "Cremorne":        [318, 272],
  "South Yarra":     [292, 284],
  "Prahran":         [274, 304],
  "Windsor":         [266, 330],
  "Hawthorn":        [344, 276],
  "Malvern":         [346, 316],
  "Kew":             [362, 226],
  "Camberwell":      [388, 294],
  "Balwyn":          [406, 234],
  "Albert Park":     [206, 316],
  "Armadale":        [322, 338],
  "Clifton Hill":    [324, 190],
  "Elwood":          [260, 376],
  "Flemington":      [146, 234],
  "Glen Iris":       [372, 322],
  "Kensington":      [176, 258],
  "Middle Park":     [194, 342],
  "Parkville":       [208, 190],
  "Preston":         [308, 120],
  "Surrey Hills":    [416, 274],
  "Toorak":          [320, 308],
};

const CARD = {
  background: "#ffffff",
  borderRadius: "20px",
  border: "1.5px solid #ede5d8",
  boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
};

export default function App() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("leaderboard");
  const [form, setForm] = useState({ suburb: "", cafe: "", price: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [animIn, setAnimIn] = useState(true);
  const [selectedSuburb, setSelectedSuburb] = useState(null);
  const [hoveredSuburb, setHoveredSuburb] = useState(null);
  const [suburbCafes, setSuburbCafes] = useState([]);
  const [suburbCafesLoading, setSuburbCafesLoading] = useState(false);
  const [cafeSearch, setCafeSearch] = useState("");

  const fetchEntries = async () => {
    try {
      const data = await query("/prices?select=*&order=created_at.desc");
      setEntries(data || []);
    } catch (e) {
      setError("Couldn't load prices. Try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  // Fetch cafes from OpenStreetMap when suburb changes
  useEffect(() => {
    if (!form.suburb || !SUBURB_LATLNG[form.suburb]) { setSuburbCafes([]); return; }
    setSuburbCafesLoading(true);
    const [lat, lng] = SUBURB_LATLNG[form.suburb];
    const q = `[out:json];(node["amenity"="cafe"]["name"](around:1400,${lat},${lng});way["amenity"="cafe"]["name"](around:1400,${lat},${lng}););out center;`;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        const cafes = (data.elements || [])
          .filter(n => n.tags?.name)
          .map(n => {
            const addr = [n.tags["addr:housenumber"], n.tags["addr:street"]].filter(Boolean).join(" ");
            return { name: n.tags.name, address: addr };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        setSuburbCafes(cafes);
      })
      .catch(() => setSuburbCafes([]))
      .finally(() => setSuburbCafesLoading(false));
  }, [form.suburb]);

  useEffect(() => {
    setAnimIn(false);
    const t = setTimeout(() => setAnimIn(true), 50);
    return () => clearTimeout(t);
  }, [view]);

  const suburbAverages = getSuburbAverages(entries);
  const allPrices = suburbAverages.map(s => s.avg);
  const minAvg = Math.min(...allPrices);
  const maxAvg = Math.max(...allPrices);
  const overallAvg = entries.length ? entries.reduce((a, b) => a + Number(b.price), 0) / entries.length : 0;
  const cheapest = suburbAverages[0];
  const priciest = suburbAverages[suburbAverages.length - 1];
  const suburbAvgMap = Object.fromEntries(suburbAverages.map(s => [s.suburb, s]));

  const handleSubmit = async () => {
    if (!form.suburb || !form.cafe || !form.price) return;
    setSubmitting(true);
    try {
      await query("/prices", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify({
          suburb: form.suburb,
          cafe: form.cafe,
          address: form.address || null,
          type: "Flat White",
          price: parseFloat(form.price),
          date: new Date().toISOString().split("T")[0]
        })
      });
      setSubmitted(true);
      setForm({ suburb: "", cafe: "", price: "", address: "" });
      setSuburbCafes([]);
      setCafeSearch("");
      await fetchEntries();
      setTimeout(() => { setSubmitted(false); setView("leaderboard"); }, 2000);
    } catch (e) {
      alert("Something went wrong submitting. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCafes = suburbCafes.filter(c =>
    c.name.toLowerCase().includes(cafeSearch.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "#faf6f0", fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "0 16px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", padding: "48px 0 32px" }}>
          <div style={{
            display: "inline-block", background: "#fff3e8", color: "#c8684a",
            fontSize: "12px", fontWeight: "700", letterSpacing: "2px",
            textTransform: "uppercase", padding: "6px 16px", borderRadius: "999px",
            border: "1.5px solid #f0d4c0", marginBottom: "20px"
          }}>
            Melbourne · Est. 2026
          </div>
          <h1 style={{
            fontSize: "clamp(42px, 10vw, 72px)", fontWeight: "800",
            lineHeight: 1.05, color: "#1e1a14", margin: "0 0 12px", letterSpacing: "-1.5px"
          }}>
            Coffee{" "}
            <span style={{ color: "#c8684a", fontStyle: "italic" }}>Spot</span>
          </h1>
          <p style={{ fontSize: "16px", color: "#a09080", fontWeight: "600" }}>
            Find your spot.
          </p>
        </div>

        {/* Stats bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "24px" }}>
          {[
            { label: "City avg", value: entries.length ? formatPrice(overallAvg) : "—", sub: "per cup", emoji: "☕" },
            { label: "Cheapest", value: cheapest?.suburb || "—", sub: cheapest ? formatPrice(cheapest.avg) : "no data", emoji: "🟢" },
            { label: "Priciest", value: priciest?.suburb || "—", sub: priciest ? formatPrice(priciest.avg) : "no data", emoji: "🔴" },
          ].map((s, i) => (
            <div key={i} style={{ ...CARD, padding: "16px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", marginBottom: "6px" }}>{s.emoji}</div>
              <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#b0a090", textTransform: "uppercase", marginBottom: "4px" }}>{s.label}</div>
              <div style={{ fontSize: "15px", fontWeight: "800", color: "#1e1a14", lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: "11px", color: "#c8b8a8", marginTop: "2px", fontWeight: "600" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {[["leaderboard", "📍 Suburbs"], ["map", "🗺 Map"], ["feed", "🕐 Recent"], ["submit", "＋ Add"]].map(([v, label]) => (
            <button key={v} onClick={() => { setView(v); setSelectedSuburb(null); }} style={{
              flex: 1, padding: "12px 8px", borderRadius: "999px",
              border: view === v ? "2px solid #c8684a" : "2px solid #ede5d8",
              background: view === v ? "#c8684a" : "#ffffff",
              color: view === v ? "#ffffff" : "#a09080",
              fontSize: "12px", fontWeight: "700", cursor: "pointer",
              fontFamily: "inherit", transition: "all 0.15s",
              boxShadow: view === v ? "0 4px 12px rgba(200,104,74,0.3)" : "none"
            }}>{label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(10px)", transition: "all 0.25s ease" }}>

          {/* SUBURB DRILLDOWN */}
          {view === "leaderboard" && selectedSuburb && (() => {
            const cafes = getSuburbCafes(entries, selectedSuburb);
            const cafeMin = Math.min(...cafes.map(c => c.avg));
            const cafeMax = Math.max(...cafes.map(c => c.avg));
            return (
              <div>
                <button onClick={() => { setSelectedSuburb(null); setAnimIn(false); setTimeout(() => setAnimIn(true), 50); }} style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  background: "#fff", border: "1.5px solid #ede5d8", borderRadius: "999px",
                  color: "#a09080", fontSize: "13px", fontWeight: "700",
                  cursor: "pointer", fontFamily: "inherit", padding: "8px 16px",
                  marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
                }}>← Back</button>
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "26px", fontWeight: "800", color: "#1e1a14", marginBottom: "4px" }}>{selectedSuburb}</div>
                  <div style={{ fontSize: "13px", color: "#b0a090", fontWeight: "600" }}>
                    {cafes.length} cafe{cafes.length !== 1 ? "s" : ""} · {cafes.reduce((a, c) => a + c.count, 0)} reports
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {cafes.map((c) => {
                    const col = getPriceColor(c.avg, cafeMin, cafeMax);
                    const bg = getPriceBg(c.avg, cafeMin, cafeMax);
                    return (
                      <div key={c.cafe} style={{ ...CARD, padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: c.items.length > 0 ? "12px" : 0 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "15px", fontWeight: "700", color: "#1e1a14" }}>{c.cafe}</div>
                            {c.items[0]?.address && <div style={{ fontSize: "11px", color: "#b0a090", fontWeight: "600", marginTop: "2px" }}>📍 {c.items[0].address}</div>}
                            <div style={{ fontSize: "12px", color: "#c8b8a8", fontWeight: "600", marginTop: "2px" }}>{c.count} report{c.count !== 1 ? "s" : ""}</div>
                          </div>
                          <div style={{ background: bg, color: col, fontWeight: "800", fontSize: "17px", padding: "6px 12px", borderRadius: "999px" }}>
                            {formatPrice(c.avg)}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {c.items.map((item, j) => (
                            <div key={j} style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              fontSize: "12px", padding: "7px 12px", borderRadius: "12px",
                              background: "#faf6f0", fontWeight: "600"
                            }}>
                              <span style={{ color: "#b0a090" }}>{item.date}</span>
                              <span style={{ color: "#786450", fontWeight: "700" }}>{formatPrice(item.price)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* LEADERBOARD */}
          {view === "leaderboard" && !selectedSuburb && (
            <div>
              {loading ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700", letterSpacing: "1px" }}>
                  Brewing data...
                </div>
              ) : error ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#e05050", fontSize: "14px", fontWeight: "700" }}>{error}</div>
              ) : suburbAverages.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>
                  No prices yet — be the first to report one!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {suburbAverages.map((s, i) => {
                    const col = getPriceColor(s.avg, minAvg, maxAvg);
                    const bg = getPriceBg(s.avg, minAvg, maxAvg);
                    return (
                      <div key={s.suburb} onClick={() => { setSelectedSuburb(s.suburb); setAnimIn(false); setTimeout(() => setAnimIn(true), 50); }}
                        style={{ ...CARD, display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", cursor: "pointer", transition: "transform 0.12s, box-shadow 0.12s" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.10)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = CARD.boxShadow; }}>
                        <div style={{
                          width: "32px", height: "32px", borderRadius: "50%",
                          background: i === 0 ? "rgba(58,170,106,0.12)" : i === suburbAverages.length - 1 ? "rgba(224,80,80,0.12)" : "#f4efe8",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "12px", fontWeight: "800", color: i === 0 ? "#3aaa6a" : i === suburbAverages.length - 1 ? "#e05050" : "#c8b8a8",
                          flexShrink: 0
                        }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "15px", fontWeight: "700", color: "#1e1a14" }}>{s.suburb}</div>
                          <div style={{ fontSize: "12px", color: "#c8b8a8", fontWeight: "600", marginTop: "1px" }}>{s.count} report{s.count !== 1 ? "s" : ""}</div>
                        </div>
                        <div style={{ background: bg, color: col, fontWeight: "800", fontSize: "16px", padding: "6px 14px", borderRadius: "999px" }}>
                          {formatPrice(s.avg)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!loading && !error && (
                <div style={{ textAlign: "center", marginTop: "20px", fontSize: "12px", color: "#d4c4b4", fontWeight: "700" }}>
                  {entries.length} price{entries.length !== 1 ? "s" : ""} across {suburbAverages.length} suburb{suburbAverages.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          )}

          {/* MAP */}
          {view === "map" && (
            <div style={{ ...CARD, padding: "20px" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>Brewing data...</div>
              ) : (
                <>
                  <svg viewBox="0 0 460 410" style={{ width: "100%", display: "block" }}
                    onMouseLeave={() => setHoveredSuburb(null)}>
                    <ellipse cx="130" cy="420" rx="160" ry="60" fill="rgba(180,220,255,0.25)" />
                    {Object.entries(SUBURB_POSITIONS).map(([suburb, [x, y]]) => {
                      const data = suburbAvgMap[suburb];
                      const col = data ? getPriceColor(data.avg, minAvg, maxAvg) : "#d4c8bc";
                      const bg  = data ? getPriceBg(data.avg, minAvg, maxAvg)   : "#f4ede6";
                      const isHov = hoveredSuburb === suburb;
                      return (
                        <g key={suburb}
                          style={{ cursor: data ? "pointer" : "default" }}
                          onClick={() => {
                            if (!data) return;
                            setSelectedSuburb(suburb);
                            setView("leaderboard");
                            setAnimIn(false);
                            setTimeout(() => setAnimIn(true), 50);
                          }}
                          onMouseEnter={() => setHoveredSuburb(suburb)}
                          onMouseLeave={() => setHoveredSuburb(null)}>
                          <circle cx={x} cy={y} r={isHov ? 15 : 12}
                            fill={bg} stroke={col} strokeWidth={isHov ? 2.5 : 1.5}
                            style={{ transition: "r 0.12s, stroke-width 0.12s" }} />
                          {data && (
                            <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle"
                              fontSize="7" fontWeight="800" fill={col}
                              style={{ pointerEvents: "none", fontFamily: "Nunito, system-ui, sans-serif" }}>
                              {formatPrice(data.avg)}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    {hoveredSuburb && (() => {
                      const [tx, ty] = SUBURB_POSITIONS[hoveredSuburb];
                      const data = suburbAvgMap[hoveredSuburb];
                      const w = Math.max(hoveredSuburb.length * 6.2, 64);
                      const h = data ? 38 : 24;
                      const above = ty > 60;
                      const tooltipY = above ? ty - 20 - h : ty + 20;
                      return (
                        <g style={{ pointerEvents: "none" }}>
                          <rect x={tx - w / 2} y={tooltipY} width={w} height={h}
                            rx={8} fill="white" stroke="#ede5d8" strokeWidth={1.5} />
                          <text x={tx} y={tooltipY + (data ? 13 : 12)}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize="8.5" fontWeight="700" fill="#1e1a14"
                            style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
                            {hoveredSuburb}
                          </text>
                          {data && (
                            <text x={tx} y={tooltipY + 27}
                              textAnchor="middle" dominantBaseline="middle"
                              fontSize="8" fontWeight="800"
                              fill={getPriceColor(data.avg, minAvg, maxAvg)}
                              style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
                              avg {formatPrice(data.avg)}
                            </text>
                          )}
                        </g>
                      );
                    })()}
                  </svg>
                  <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "12px" }}>
                    {[["#3aaa6a", "Cheaper"], ["#d4a030", "Mid"], ["#e05050", "Pricier"], ["#d4c8bc", "No data"]].map(([color, label]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: color }} />
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#b0a090" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: "10px", fontSize: "11px", color: "#d4c4b4", fontWeight: "600" }}>
                    Tap a suburb to see its cafes
                  </div>
                </>
              )}
            </div>
          )}

          {/* FEED */}
          {view === "feed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>Brewing data...</div>
              ) : entries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>No prices yet — be the first!</div>
              ) : entries.map((e) => (
                <div key={e.id} style={{ ...CARD, padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "14px",
                    background: "#fff3e8", border: "1.5px solid #f0d4c0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "22px", flexShrink: 0
                  }}>☕</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e1a14", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.cafe}</div>
                    <div style={{ fontSize: "12px", color: "#b0a090", fontWeight: "600", marginTop: "2px" }}>{e.suburb} · {e.date}</div>
                  </div>
                  <div style={{ background: "#fff3e8", color: "#c8684a", fontWeight: "800", fontSize: "16px", padding: "6px 14px", borderRadius: "999px", flexShrink: 0 }}>
                    {formatPrice(e.price)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUBMIT */}
          {view === "submit" && (
            <div style={{ ...CARD, padding: "28px 24px" }}>
              {submitted ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
                  <div style={{ color: "#3aaa6a", fontSize: "20px", fontWeight: "800", marginBottom: "8px" }}>Cheers for that!</div>
                  <div style={{ color: "#b0a090", fontSize: "14px", fontWeight: "600" }}>Price added to the index</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#1e1a14", marginBottom: "24px" }}>
                    Report a Price ☕
                  </div>

                  {/* Step 1: Suburb */}
                  <div style={{ marginBottom: "18px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px", color: "#b0a090", textTransform: "uppercase", marginBottom: "8px" }}>Suburb</div>
                    <select value={form.suburb} onChange={e => {
                      setForm({ suburb: e.target.value, cafe: "", price: form.price, address: "" });
                      setCafeSearch("");
                    }} style={inputStyle}>
                      <option value="">Select suburb...</option>
                      {SUBURBS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Step 2: Cafe picker */}
                  {form.suburb && (
                    <div style={{ marginBottom: "18px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px", color: "#b0a090", textTransform: "uppercase", marginBottom: "8px" }}>Cafe</div>
                      {form.cafe ? (
                        <div style={{
                          padding: "12px 16px", borderRadius: "14px", background: "#fff3e8",
                          border: "1.5px solid #f0d4c0", display: "flex", alignItems: "center", justifyContent: "space-between"
                        }}>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e1a14" }}>{form.cafe}</div>
                            {form.address && <div style={{ fontSize: "11px", color: "#b0a090", marginTop: "2px" }}>📍 {form.address}</div>}
                          </div>
                          <button onClick={() => { setForm({ ...form, cafe: "", address: "" }); setCafeSearch(""); }} style={{
                            background: "none", border: "none", color: "#c8684a", fontSize: "12px",
                            fontWeight: "700", cursor: "pointer", fontFamily: "inherit", flexShrink: 0
                          }}>Change</button>
                        </div>
                      ) : suburbCafesLoading ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#b0a090", fontSize: "13px", fontWeight: "700", background: "#faf6f0", borderRadius: "14px" }}>
                          Finding cafes in {form.suburb}...
                        </div>
                      ) : (
                        <div style={{ ...CARD, padding: "10px" }}>
                          <input
                            placeholder={`Search cafes in ${form.suburb}...`}
                            value={cafeSearch}
                            onChange={e => setCafeSearch(e.target.value)}
                            style={{ ...inputStyle, marginBottom: "6px" }}
                            autoComplete="off"
                          />
                          <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                            {filteredCafes.length === 0 && !cafeSearch && (
                              <div style={{ padding: "12px", textAlign: "center", color: "#c8b8a8", fontSize: "13px", fontWeight: "600" }}>
                                No cafes found in OpenStreetMap
                              </div>
                            )}
                            {filteredCafes.map((c, i) => (
                              <div key={i}
                                onClick={() => { setForm({ ...form, cafe: c.name, address: c.address }); setCafeSearch(""); }}
                                style={{ padding: "10px 12px", borderRadius: "10px", cursor: "pointer", marginBottom: "2px" }}
                                onMouseEnter={e => e.currentTarget.style.background = "#faf6f0"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e1a14" }}>{c.name}</div>
                                {c.address && <div style={{ fontSize: "11px", color: "#b0a090", marginTop: "1px" }}>{c.address}</div>}
                              </div>
                            ))}
                            {/* Add manually if not found */}
                            {cafeSearch && !suburbCafes.find(c => c.name.toLowerCase() === cafeSearch.toLowerCase()) && (
                              <div
                                onClick={() => { setForm({ ...form, cafe: cafeSearch, address: "" }); setCafeSearch(""); }}
                                style={{ padding: "10px 12px", borderRadius: "10px", cursor: "pointer", borderTop: filteredCafes.length > 0 ? "1px solid #f0ece8" : "none", marginTop: "4px" }}
                                onMouseEnter={e => e.currentTarget.style.background = "#fff3e8"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#c8684a" }}>+ Add "{cafeSearch}"</div>
                                <div style={{ fontSize: "11px", color: "#b0a090", marginTop: "1px" }}>Not listed? Add it manually</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: Price */}
                  {form.cafe && (
                    <div style={{ marginBottom: "18px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px", color: "#b0a090", textTransform: "uppercase", marginBottom: "8px" }}>Price ($)</div>
                      <input type="number" placeholder="4.00" step="0.10" min="0.50" max="20"
                        value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={inputStyle} />
                    </div>
                  )}

                  <button onClick={handleSubmit} disabled={submitting || !form.suburb || !form.cafe || !form.price} style={{
                    width: "100%", padding: "15px", borderRadius: "999px",
                    background: "#c8684a", border: "none", color: "#ffffff",
                    fontSize: "14px", fontWeight: "800", letterSpacing: "0.5px",
                    cursor: (submitting || !form.suburb || !form.cafe || !form.price) ? "not-allowed" : "pointer",
                    fontFamily: "inherit", marginTop: "8px",
                    opacity: (submitting || !form.suburb || !form.cafe || !form.price) ? 0.45 : 1,
                    transition: "opacity 0.2s",
                    boxShadow: "0 4px 14px rgba(200,104,74,0.35)"
                  }}>
                    {submitting ? "Submitting..." : "Submit Price"}
                  </button>
                  <div style={{ textAlign: "center", marginTop: "14px", fontSize: "12px", color: "#d4c4b4", fontWeight: "600" }}>
                    No account needed. Just the vibe.
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 16px", borderRadius: "14px",
  background: "#faf6f0", border: "1.5px solid #ede5d8",
  color: "#1e1a14", fontSize: "14px", fontFamily: "'Nunito', system-ui, sans-serif",
  fontWeight: "600", boxSizing: "border-box", outline: "none",
  appearance: "none", WebkitAppearance: "none",
  transition: "border-color 0.15s"
};
