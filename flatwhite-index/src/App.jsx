import { useState, useEffect } from "react";
import { query, formatPrice, CARD, VIBES, KNOWN_CAFES, haversine, formatDist } from "./utils";

const timeAgo = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins} min${mins  !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (days  < 7)  return `${days} day${days  !== 1 ? "s" : ""} ago`;
  return new Date(ts).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};

const SUBURBS = [
  "Abbotsford", "Albert Park", "Armadale", "Balwyn", "Brunswick",
  "Camberwell", "Carlton", "CBD", "Clifton Hill", "Coburg",
  "Collingwood", "Cremorne", "Docklands", "Elwood", "Essendon",
  "Fitzroy", "Flemington", "Footscray", "Glen Iris", "Hawthorn",
  "Kensington", "Kew", "Malvern", "Middle Park", "Moonee Ponds",
  "Newport", "North Melbourne", "Northcote", "Parkville", "Pascoe Vale", "Port Melbourne", "Prahran",
  "Preston", "Reservoir", "Richmond", "South Melbourne", "South Yarra", "St Kilda",
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
  "North Melbourne": [-37.801, 144.943],
  "Northcote":       [-37.772, 145.011],
  "Parkville":       [-37.789, 144.958],
  "Pascoe Vale":     [-37.726, 144.950],
  "Port Melbourne":  [-37.836, 144.936],
  "Prahran":         [-37.850, 144.993],
  "Preston":         [-37.748, 145.009],
  "Reservoir":       [-37.718, 145.002],
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
    map[e.cafe].push({ price: Number(e.price), type: e.type, date: e.date, address: e.address, name: e.name || "Anonymous" });
  });
  return Object.entries(map).map(([cafe, items]) => ({
    cafe,
    avg: items.reduce((a, b) => a + b.price, 0) / items.length,
    count: items.length,
    items: items.sort((a, b) => new Date(b.date) - new Date(a.date))
  })).sort((a, b) => a.avg - b.avg);
};

const getAllCafes = (entries) => {
  const map = {};
  // entries are ordered created_at.desc, so first encounter = latest entry
  entries.forEach(e => {
    const key = `${e.cafe}||${e.suburb}`;
    if (!map[key]) map[key] = { cafe: e.cafe, suburb: e.suburb, prices: [], latestEntryId: e.id, lastConfirmed: null };
    map[key].prices.push(Number(e.price));
    if (e.last_confirmed && (!map[key].lastConfirmed || e.last_confirmed > map[key].lastConfirmed)) {
      map[key].lastConfirmed = e.last_confirmed;
    }
  });
  return Object.values(map).map(c => ({
    cafe: c.cafe,
    suburb: c.suburb,
    avg: c.prices.reduce((a, b) => a + b, 0) / c.prices.length,
    count: c.prices.length,
    latestEntryId: c.latestEntryId,
    lastConfirmed: c.lastConfirmed,
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
  "North Melbourne": [196, 228],
  "Parkville":       [208, 190],
  "Pascoe Vale":     [200, 100],
  "Preston":         [308, 120],
  "Reservoir":       [310, 92],
  "Surrey Hills":    [416, 274],
  "Toorak":          [320, 308],
};



const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function CafeCard({ cafe, suburb, price, vibes, onLog, latestEntryId, lastConfirmed, onConfirm, saved, onToggleSave }) {
  const [confirmState, setConfirmState] = useState("idle"); // idle | asking | done | error
  const [confirmError, setConfirmError] = useState(null);
  const [heartAnim, setHeartAnim] = useState(false);

  const isRecentlyConfirmed = lastConfirmed &&
    (Date.now() - new Date(lastConfirmed).getTime()) < THIRTY_DAYS_MS;
  const showBadge = isRecentlyConfirmed || confirmState === "done";

  const handleConfirm = async () => {
    setConfirmError(null);
    setConfirmState("done"); // optimistic — show Thank you! immediately
    try {
      await onConfirm(latestEntryId);
    } catch (e) {
      setConfirmState("idle"); // revert if save failed
      setConfirmError(e.message || "Couldn't save — check Supabase column/permissions.");
    }
  };

  return (
    <div style={{ ...CARD, padding: "18px 18px 14px", overflow: "visible" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "15px", fontWeight: "800", color: "#1e1a14", lineHeight: 1.2 }}>{cafe}</div>
          <div style={{ fontSize: "12px", color: "#b0a090", fontWeight: "600", marginTop: "3px" }}>📍 {suburb}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {onToggleSave && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => {
                  if (!saved) {
                    setHeartAnim(true);
                    setTimeout(() => setHeartAnim(false), 750);
                  }
                  onToggleSave(cafe, suburb);
                }}
                title={saved ? "Remove from saved" : "Save this cafe"}
                style={{
                  background: saved ? "#fff0eb" : "transparent",
                  border: `1.5px solid ${saved ? "#f0d4c0" : "#ede5d8"}`,
                  borderRadius: "50%", width: "34px", height: "34px",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px", color: saved ? "#c8684a" : "#c8b8a8",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                  animation: heartAnim ? "heartPop 0.45s ease" : "none",
                }}
                onMouseEnter={e => {
                  if (!heartAnim) e.currentTarget.style.transform = "scale(1.1)";
                  e.currentTarget.style.background = "#fff0eb";
                  e.currentTarget.style.borderColor = "#f0d4c0";
                  e.currentTarget.style.color = "#c8684a";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.background = saved ? "#fff0eb" : "transparent";
                  e.currentTarget.style.borderColor = saved ? "#f0d4c0" : "#ede5d8";
                  e.currentTarget.style.color = saved ? "#c8684a" : "#c8b8a8";
                }}
              >
                {saved ? "♥" : "♡"}
              </button>
              {/* Floating hearts burst */}
              {heartAnim && [
                { hx: "-10px", delay: "0ms",   size: "13px" },
                { hx:   "0px", delay: "60ms",  size: "16px" },
                { hx:  "10px", delay: "30ms",  size: "11px" },
                { hx:  "-5px", delay: "110ms", size: "10px" },
                { hx:  "14px", delay: "80ms",  size: "9px"  },
              ].map((h, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    bottom: "50%",
                    left: "50%",
                    marginLeft: "-8px",
                    fontSize: h.size,
                    color: "#c8684a",
                    pointerEvents: "none",
                    "--hx": h.hx,
                    animation: `heartFloat 0.65s ease ${h.delay} forwards`,
                    zIndex: 20,
                    userSelect: "none",
                  }}
                >♥</div>
              ))}
            </div>
          )}
          <div style={{
            background: "#fff3e8", color: "#c8684a", fontWeight: "800", fontSize: "17px",
            padding: "6px 14px", borderRadius: "999px", border: "1.5px solid #f0d4c0"
          }}>
            ${Number(price).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Confirmed badge */}
      {showBadge && (
        <div style={{ marginBottom: "10px" }}>
          <span style={{
            fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px",
            background: "#edfaf3", color: "#3a7a5a", border: "1.5px solid #b8e8cc",
            display: "inline-flex", alignItems: "center", gap: "4px",
          }}>✓ Confirmed recently</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Confirmation UI */}
        {confirmState === "asking" ? (
          <div style={{
            padding: "12px 14px", borderRadius: "14px",
            background: "#f6fbf8", border: "1.5px solid #b8e8cc",
            animation: "fadeIn 0.15s ease",
          }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#3a7a5a", marginBottom: "10px" }}>
              Still ${Number(price).toFixed(2)}?
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1, padding: "9px", borderRadius: "999px",
                  background: "#3a7a5a", border: "none", color: "#fff",
                  fontSize: "12px", fontWeight: "800", cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 2px 8px rgba(58,122,90,0.25)",
                }}
              >✓ Yes, still right</button>
              <button
                onClick={() => setConfirmState("idle")}
                style={{
                  flex: 1, padding: "9px", borderRadius: "999px",
                  background: "transparent", border: "1.5px solid #ede5d8",
                  color: "#a09080", fontSize: "12px", fontWeight: "700",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancel</button>
            </div>
          </div>
        ) : confirmState === "done" ? (
          <div style={{ textAlign: "center", fontSize: "13px", color: "#3a7a5a", fontWeight: "800", padding: "6px 0", animation: "fadeIn 0.2s ease" }}>
            Thank you! 🙌
          </div>
        ) : !showBadge && (
          <button
            onClick={() => setConfirmState("asking")}
            style={{
              width: "100%", padding: "10px", borderRadius: "999px",
              background: "transparent", border: "1.5px solid #ede5d8",
              color: "#a09080", fontSize: "13px", fontWeight: "700",
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#b8e8cc"; e.currentTarget.style.color = "#3a7a5a"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede5d8"; e.currentTarget.style.color = "#a09080"; }}
          >Is this still right?</button>
        )}

        <button
          onClick={onLog}
          style={{
            width: "100%", padding: "10px", borderRadius: "999px",
            background: "transparent", border: "1.5px solid #ede5d8",
            color: "#c8684a", fontSize: "13px", fontWeight: "700",
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#fff3e8"; e.currentTarget.style.borderColor = "#f0d4c0"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#ede5d8"; }}
        >☕ Log a coffee here</button>

        {confirmError && (
          <div style={{ fontSize: "11px", color: "#e05050", fontWeight: "600", padding: "4px 4px 0", lineHeight: 1.4 }}>
            ⚠ {confirmError}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState(() => window.location.hash === "#map" ? "map" : "leaderboard");
  const [form, setForm] = useState({ suburb: "", cafe: "", price: "", address: "", vibes: [], name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [animIn, setAnimIn] = useState(true);
  const [selectedSuburb, setSelectedSuburb] = useState(null);
  const [renderedView, setRenderedView] = useState(() => window.location.hash === "#map" ? "map" : "leaderboard");
  const [hoveredSuburb, setHoveredSuburb] = useState(null);
  const [suburbCafes, setSuburbCafes] = useState([]);
  const [suburbCafesLoading, setSuburbCafesLoading] = useState(false);
  const [cafeSearch, setCafeSearch] = useState("");
  const [search, setSearch] = useState("");
  const [nearMe, setNearMe] = useState("idle"); // idle | loading | done | error
  const [showPriceWarning, setShowPriceWarning] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [nearMeResults, setNearMeResults] = useState([]);
  // True when user arrived via the landing page "Show me my 3 closest" button
  const [pendingNearMe, setPendingNearMe] = useState(
    () => window.location.hash === "#near-me"
  );
  const [savedCafes, setSavedCafes] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("cs_saved_cafes") || "[]")); }
    catch { return new Set(); }
  });

  const toggleSave = (cafe, suburb) => {
    const key = `${cafe}||${suburb}`;
    setSavedCafes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem("cs_saved_cafes", JSON.stringify([...next]));
      return next;
    });
  };

  const confirmPrice = async (entryId) => {
    const now = new Date().toISOString();
    await query(`/prices?id=eq.${entryId}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ last_confirmed: now })
    });
    // Optimistic update — avoids refetching which unmounts cards and wipes local confirmState
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, last_confirmed: now } : e));
  };

  const fetchEntries = async () => {
    setLoading(true);
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

  // Clear #map hash on mount so refresh doesn't re-apply the view
  useEffect(() => {
    if (window.location.hash === "#map") window.location.hash = "#app";
  }, []);

  // Auto-trigger near-me when arriving from the landing page CTA
  useEffect(() => {
    if (pendingNearMe && !loading) {
      setPendingNearMe(false);
      window.location.hash = "#app";
      findNearMe();
    }
  }, [pendingNearMe, loading]);

  const findNearMe = () => {
    if (!navigator.geolocation) { setNearMe("error"); return; }
    setNearMe("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Build average price map from current entries
        const priceMap = {};
        entries.forEach(e => {
          if (!priceMap[e.cafe]) priceMap[e.cafe] = [];
          priceMap[e.cafe].push(Number(e.price));
        });
        const results = KNOWN_CAFES
          .map(cafe => {
            const dist = haversine(latitude, longitude, cafe.lat, cafe.lng);
            const prices = priceMap[cafe.name] || [];
            const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
            return { ...cafe, dist, avgPrice };
          })
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3);
        setNearMeResults(results);
        setNearMe("done");
      },
      () => setNearMe("error")
    );
  };

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

  // Fade out, run state update, fade back in
  const animate = (fn) => {
    setAnimIn(false);
    setTimeout(() => { fn(); setAnimIn(true); }, 180);
  };

  const changeView = (v) => {
    setView(v); // highlight nav immediately
    animate(() => { setRenderedView(v); setSelectedSuburb(null); setSearch(""); });
  };

  const suburbAverages = getSuburbAverages(entries);
  const allPrices = suburbAverages.map(s => s.avg);
  const minAvg = Math.min(...allPrices);
  const maxAvg = Math.max(...allPrices);
  const overallAvg = entries.length ? entries.reduce((a, b) => a + Number(b.price), 0) / entries.length : 0;
  const cheapest = suburbAverages[0];
  const priciest = suburbAverages[suburbAverages.length - 1];
  const suburbAvgMap = Object.fromEntries(suburbAverages.map(s => [s.suburb, s]));
  const allEntryPrices = entries.map(e => Number(e.price));
  const minEntryPrice = allEntryPrices.length ? Math.min(...allEntryPrices) : 0;
  const maxEntryPrice = allEntryPrices.length ? Math.max(...allEntryPrices) : 0;

  const submitHint = !form.suburb ? "Pick a suburb to get started"
    : !form.cafe ? "Choose a cafe above"
    : !form.price ? "Enter the price above"
    : null;

  const doSubmit = async () => {
    setShowPriceWarning(false);
    setSubmitError(null);
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
          date: new Date().toISOString().split("T")[0],
          name: form.name.trim() || "Anonymous"
        })
      });
      if (form.email.trim()) {
        try {
          await query("/subscribers", {
            method: "POST",
            prefer: "return=minimal",
            body: JSON.stringify({
              email: form.email.trim(),
              name: form.name.trim() || null,
            })
          });
        } catch (_) { /* silently ignore — don't block submission */ }
      }
      setSubmitted(true);
      setForm({ suburb: "", cafe: "", price: "", address: "", vibes: [], name: "", email: "" });
      setSuburbCafes([]);
      setCafeSearch("");
      await fetchEntries();
      setTimeout(() => { setSubmitted(false); changeView("leaderboard"); }, 2000);
    } catch (e) {
      setSubmitError(e.message || "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!form.suburb || !form.cafe || !form.price) return;
    const newPrice = parseFloat(form.price);
    const existing = entries.filter(e => e.cafe === form.cafe).map(e => Number(e.price));
    if (existing.length > 0) {
      const avg = existing.reduce((a, b) => a + b, 0) / existing.length;
      if (Math.abs(newPrice - avg) / avg > 0.30) {
        setShowPriceWarning(true);
        return;
      }
    }
    doSubmit();
  };

  // Dismiss price warning and clear errors if the user changes the cafe or price
  useEffect(() => { setShowPriceWarning(false); setSubmitError(null); }, [form.cafe, form.price]);

  // Refresh data every 30 s while the changelog tab is open
  useEffect(() => {
    if (renderedView !== "changelog") return;
    fetchEntries();
    const id = setInterval(fetchEntries, 30000);
    return () => clearInterval(id);
  }, [renderedView]);

  // Cafes already in the index for this suburb, shown first in the picker
  const indexCafesForSuburb = form.suburb
    ? [...new Map(
        entries
          .filter(e => e.suburb === form.suburb)
          .map(e => [e.cafe, {
            name: e.cafe,
            address: entries.find(en => en.cafe === e.cafe && en.suburb === form.suburb && en.address)?.address || "",
            inIndex: true,
          }])
      ).values()].sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // Merge: index cafes first, then OSM cafes not already covered
  const mergedCafes = [...indexCafesForSuburb];
  suburbCafes.forEach(c => {
    if (!mergedCafes.find(a => a.name.toLowerCase() === c.name.toLowerCase())) {
      mergedCafes.push({ ...c, inIndex: false });
    }
  });

  const filteredCafes = mergedCafes.filter(c =>
    c.name.toLowerCase().includes(cafeSearch.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "#faf6f0", fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "0 16px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", padding: "48px 0 32px" }}>
          <h1 style={{
            fontSize: "clamp(42px, 10vw, 72px)", fontWeight: "800",
            lineHeight: 1.05, color: "#1e1a14", margin: "0 0 12px", letterSpacing: "-1.5px"
          }}>
            Coffee{" "}
            <span style={{ color: "#c8684a", fontStyle: "italic" }}>Spot</span>
          </h1>
          <p style={{ fontSize: "16px", color: "#a09080", fontWeight: "600" }}>
            Find your spot in Melbourne
          </p>

          {/* Hero CTA */}
          <div style={{ marginTop: "28px" }}>
            {nearMe !== "done" && (
              <button
                onClick={findNearMe}
                disabled={nearMe === "loading"}
                style={{
                  padding: "18px 40px", borderRadius: "999px",
                  background: nearMe === "loading" ? "#d4967a" : "#c8684a",
                  border: "none", color: "#ffffff",
                  fontSize: "18px", fontWeight: "800", letterSpacing: "0.2px",
                  cursor: nearMe === "loading" ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 8px 28px rgba(200,104,74,0.45)",
                  transition: "background 0.2s, box-shadow 0.2s, transform 0.1s",
                  display: "inline-flex", alignItems: "center", gap: "10px",
                }}
                onMouseEnter={e => { if (nearMe !== "loading") { e.currentTarget.style.boxShadow = "0 10px 32px rgba(200,104,74,0.55)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 8px 28px rgba(200,104,74,0.45)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {nearMe === "loading" ? (
                  <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span> Finding cafes...</>
                ) : (
                  <><span>📍</span> Find coffee near me</>
                )}
              </button>
            )}
            {nearMe === "error" && (
              <p style={{ marginTop: "12px", fontSize: "13px", color: "#e05050", fontWeight: "600", margin: "12px 0 0" }}>
                Couldn't get your location — check browser permissions and try again.
              </p>
            )}
          </div>
        </div>

        {/* Near Me Results */}
        {nearMe === "done" && nearMeResults.length > 0 && (
          <div style={{ marginBottom: "24px", animation: "fadeSlideIn 0.35s ease" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "#1e1a14", lineHeight: 1.2 }}>Nearest to you</div>
                <div style={{ fontSize: "13px", color: "#b0a090", fontWeight: "600", marginTop: "3px" }}>3 closest cafes in the index</div>
              </div>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <button
                  onClick={findNearMe}
                  style={{
                    padding: "8px 16px", borderRadius: "999px",
                    border: "1.5px solid #ede5d8", background: "#ffffff",
                    color: "#a09080", fontSize: "12px", fontWeight: "700",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8684a"; e.currentTarget.style.color = "#c8684a"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede5d8"; e.currentTarget.style.color = "#a09080"; }}
                >↻ Refresh</button>
                <button
                  onClick={() => setNearMe("idle")}
                  style={{
                    padding: "8px 16px", borderRadius: "999px",
                    border: "1.5px solid #ede5d8", background: "#ffffff",
                    color: "#a09080", fontSize: "12px", fontWeight: "700",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8684a"; e.currentTarget.style.color = "#c8684a"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede5d8"; e.currentTarget.style.color = "#a09080"; }}
                >✕ Close</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {nearMeResults.map((cafe, i) => (
                <div key={cafe.name} style={{ ...CARD, padding: "18px 18px 14px", position: "relative", overflow: "hidden", animation: `fadeSlideIn 0.3s ease ${i * 60}ms both` }}>
                  {/* Rank badge */}
                  <div style={{
                    position: "absolute", top: "14px", left: "-2px",
                    background: i === 0 ? "#c8684a" : "#e8ddd4",
                    color: i === 0 ? "#ffffff" : "#a09080",
                    fontSize: "11px", fontWeight: "800",
                    padding: "4px 12px 4px 14px",
                    borderRadius: "0 999px 999px 0",
                    letterSpacing: "0.5px",
                  }}>#{i + 1}</div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px", marginTop: "8px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: "800", color: "#1e1a14", lineHeight: 1.2 }}>{cafe.name}</div>
                      <div style={{ fontSize: "12px", color: "#b0a090", fontWeight: "600", marginTop: "3px" }}>📍 {cafe.suburb}</div>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#c8684a", marginTop: "4px" }}>
                        📏 {formatDist(cafe.dist)}
                      </div>
                    </div>
                    {cafe.avgPrice !== null ? (
                      <div style={{
                        background: "#fff3e8", color: "#c8684a", fontWeight: "800", fontSize: "17px",
                        padding: "6px 14px", borderRadius: "999px", flexShrink: 0, border: "1.5px solid #f0d4c0"
                      }}>
                        ${cafe.avgPrice.toFixed(2)}
                      </div>
                    ) : (
                      <div style={{
                        background: "#f4ede6", color: "#c8b8a8", fontWeight: "700", fontSize: "13px",
                        padding: "6px 14px", borderRadius: "999px", flexShrink: 0, border: "1.5px solid #ede5d8"
                      }}>
                        No data
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blurb */}
        <div style={{
          background: "#ffffff", borderRadius: "20px",
          border: "1.5px solid #ede5d8", padding: "20px 24px",
          marginBottom: "16px", textAlign: "left",
        }}>
          <p style={{ fontSize: "14px", lineHeight: "1.7", color: "#786450", fontWeight: "600", margin: 0 }}>
            Flat whites are pushing <strong style={{ color: "#1e1a14" }}>$6</strong> and climbing.
            Google's no help — it serves up the busy chains and tourist traps, not the hidden gems worth finding.{" "}
            <strong style={{ color: "#1e1a14" }}>Coffee Spot</strong> is community-built: locals reporting real prices
            at real cafes, so you always know where to get a great cup without the markup.
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
        <div style={{ display: "flex", gap: "5px", marginBottom: "24px", alignItems: "center" }}>
          {[["leaderboard", "☕ Cafes"], ["map", "🗺 Map"], ["feed", "🕐 Recent"], ["changelog", "📋 Log"], ["saved", `♥ Saved${savedCafes.size > 0 ? ` (${savedCafes.size})` : ""}`], ["submit", "＋ Add"]].map(([v, label]) => (
            <button key={v} onClick={() => changeView(v)} style={{
              flex: 1, padding: "10px 4px", borderRadius: "999px",
              border: view === v ? "2px solid #c8684a" : "2px solid #ede5d8",
              background: view === v ? "#c8684a" : "#ffffff",
              color: view === v ? "#ffffff" : "#a09080",
              fontSize: "11px", fontWeight: "700", cursor: "pointer",
              fontFamily: "inherit", transition: "all 0.15s",
              boxShadow: view === v ? "0 4px 12px rgba(200,104,74,0.3)" : "none",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{label}</button>
          ))}
          <button
            onClick={fetchEntries}
            title="Refresh"
            style={{
              width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
              border: "2px solid #ede5d8", background: "#ffffff",
              color: "#a09080", fontSize: "16px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", fontFamily: "inherit",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8684a"; e.currentTarget.style.color = "#c8684a"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede5d8"; e.currentTarget.style.color = "#a09080"; }}
          >↻</button>
        </div>

        {/* Search bar */}
        {(renderedView === "leaderboard" || renderedView === "feed") && !selectedSuburb && (
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <span style={{
              position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)",
              fontSize: "16px", pointerEvents: "none", opacity: 0.5,
            }}>🔍</span>
            <input
              type="text"
              placeholder="Search cafes or suburbs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "13px 16px 13px 42px",
                borderRadius: "999px", border: "1.5px solid #ede5d8",
                background: "#ffffff", color: "#1e1a14",
                fontSize: "14px", fontFamily: "'Nunito', system-ui, sans-serif",
                fontWeight: "600", boxSizing: "border-box",
                outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
              onFocus={e => { e.target.style.borderColor = "#c8684a"; e.target.style.boxShadow = "0 0 0 3px rgba(200,104,74,0.12)"; }}
              onBlur={e => { e.target.style.borderColor = "#ede5d8"; e.target.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
                  background: "#ede5d8", border: "none", borderRadius: "50%",
                  width: "20px", height: "20px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", color: "#a09080", fontWeight: "800", fontFamily: "inherit",
                }}
              >✕</button>
            )}
          </div>
        )}

        {/* Content */}
        <div style={{ opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(8px)", transition: "opacity 0.18s ease, transform 0.22s ease" }}>

          {/* SUBURB DRILLDOWN */}
          {renderedView === "leaderboard" && selectedSuburb && (() => {
            const cafes = getSuburbCafes(entries, selectedSuburb);
            const cafeMin = Math.min(...cafes.map(c => c.avg));
            const cafeMax = Math.max(...cafes.map(c => c.avg));
            return (
              <div>
                <button onClick={() => animate(() => setSelectedSuburb(null))} style={{
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
                              <div>
                                <span style={{ color: "#b0a090" }}>{item.date}</span>
                                <span style={{ color: "#c8b8a8", marginLeft: "8px" }}>spotted by {item.name}</span>
                              </div>
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

          {/* CAFE LIST */}
          {renderedView === "leaderboard" && !selectedSuburb && (() => {
            if (loading) return (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>Brewing data...</div>
            );
            if (error) return (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#e05050", fontSize: "14px", fontWeight: "700" }}>{error}</div>
            );
            const allCafes = getAllCafes(entries);
            const q = search.toLowerCase();
            const filtered = allCafes.filter(c =>
              c.cafe.toLowerCase().includes(q) || c.suburb.toLowerCase().includes(q)
            );
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>
                    {search ? `No cafes match "${search}"` : "No prices yet — be the first to report one!"}
                  </div>
                ) : filtered.map(c => (
                  <CafeCard
                    key={`${c.cafe}||${c.suburb}`}
                    cafe={c.cafe}
                    suburb={c.suburb}
                    price={c.avg}
                    vibes={[]}
                    latestEntryId={c.latestEntryId}
                    lastConfirmed={c.lastConfirmed}
                    onConfirm={confirmPrice}
                    saved={savedCafes.has(`${c.cafe}||${c.suburb}`)}
                    onToggleSave={toggleSave}
                    onLog={() => {
                      setForm({ suburb: c.suburb, cafe: c.cafe, price: "", address: "", vibes: [], name: "", email: "" });
                      setCafeSearch("");
                      changeView("submit");
                    }}
                  />
                ))}
                {filtered.length > 0 && (
                  <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#d4c4b4", fontWeight: "700" }}>
                    {search ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}` : `${allCafes.length} cafes across ${[...new Set(allCafes.map(c => c.suburb))].length} suburbs`}
                  </div>
                )}
              </div>
            );
          })()}

          {/* MAP */}
          {renderedView === "map" && (
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
                            changeView("leaderboard");
                            setTimeout(() => setSelectedSuburb(suburb), 180);
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
                  <div style={{
                    textAlign: "center", marginTop: "12px", padding: "10px 16px",
                    background: "#fff3e8", borderRadius: "12px",
                    fontSize: "12px", color: "#c8684a", fontWeight: "700",
                  }}>
                    👆 Tap a coloured dot to explore that suburb's cafes
                  </div>
                </>
              )}
            </div>
          )}

          {/* FEED */}
          {renderedView === "feed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>Brewing data...</div>
              ) : entries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>No prices yet — be the first!</div>
              ) : (() => {
                const q = search.toLowerCase();
                const filtered = entries.filter(e =>
                  e.cafe.toLowerCase().includes(q) || e.suburb.toLowerCase().includes(q)
                );
                if (filtered.length === 0) return (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>
                    No results for "{search}"
                  </div>
                );
                return filtered.map((e) => {
                const col = getPriceColor(Number(e.price), minEntryPrice, maxEntryPrice);
                const bg  = getPriceBg(Number(e.price), minEntryPrice, maxEntryPrice);
                return (
                  <div key={e.id} style={{ ...CARD, padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{
                      width: "44px", height: "44px", borderRadius: "14px",
                      background: "#fff3e8", border: "1.5px solid #f0d4c0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "22px", flexShrink: 0
                    }}>☕</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e1a14", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.cafe}</div>
                      <div style={{ fontSize: "12px", color: "#b0a090", fontWeight: "600", marginTop: "2px" }}>{e.suburb} · {e.date} · spotted by {e.name || "Anonymous"}</div>
                    </div>
                    <div style={{ background: bg, color: col, fontWeight: "800", fontSize: "16px", padding: "6px 14px", borderRadius: "999px", flexShrink: 0 }}>
                      {formatPrice(e.price)}
                    </div>
                  </div>
                );
              });
              })()}
            </div>
          )}

          {/* CHANGELOG */}
          {renderedView === "changelog" && (() => {
            if (loading) return (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>Brewing data...</div>
            );

            // Build a merged event stream: submissions + confirmations
            const events = entries.flatMap(e => {
              const base = { cafe: e.cafe, suburb: e.suburb, price: Number(e.price), name: e.name || "Anonymous" };
              const out = [{ ...base, id: `s-${e.id}`, type: "spotted",   timestamp: e.created_at }];
              if (e.last_confirmed) out.push({ ...base, id: `c-${e.id}`, type: "confirmed", timestamp: e.last_confirmed });
              return out;
            }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (events.length === 0) return (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#c8b8a8", fontSize: "14px", fontWeight: "700" }}>
                No activity yet — be the first to report a price!
              </div>
            );

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {events.map(ev => {
                  const isConfirm = ev.type === "confirmed";
                  return (
                    <div key={ev.id} style={{ ...CARD, padding: "13px 16px", display: "flex", alignItems: "center", gap: "13px" }}>
                      {/* Icon */}
                      <div style={{
                        width: "42px", height: "42px", borderRadius: "13px", flexShrink: 0,
                        background: isConfirm ? "#edfaf3" : "#fff3e8",
                        border: `1.5px solid ${isConfirm ? "#b8e8cc" : "#f0d4c0"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: isConfirm ? "16px" : "20px",
                        color: isConfirm ? "#3a7a5a" : undefined,
                        fontWeight: "800",
                      }}>
                        {isConfirm ? "✓" : "☕"}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e1a14", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ev.cafe}
                        </div>
                        <div style={{ fontSize: "12px", color: "#b0a090", fontWeight: "600", marginTop: "1px" }}>
                          {ev.suburb}
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "700", marginTop: "3px", color: isConfirm ? "#3a7a5a" : "#c8684a" }}>
                          {isConfirm
                            ? `confirmed ${formatPrice(ev.price)} still correct`
                            : `spotted ${formatPrice(ev.price)}`}
                          <span style={{ color: "#c8b8a8", fontWeight: "600" }}> · {ev.name}</span>
                        </div>
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: "11px", color: "#c8b8a8", fontWeight: "700", flexShrink: 0, textAlign: "right", minWidth: "52px" }}>
                        {timeAgo(ev.timestamp)}
                      </div>
                    </div>
                  );
                })}
                <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#d4c4b4", fontWeight: "700" }}>
                  {events.length} event{events.length !== 1 ? "s" : ""} · refreshes every 30s
                </div>
              </div>
            );
          })()}

          {/* SAVED */}
          {renderedView === "saved" && (() => {
            if (savedCafes.size === 0) return (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>♡</div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#1e1a14", marginBottom: "8px" }}>No saved cafes yet</div>
                <div style={{ fontSize: "13px", color: "#b0a090", fontWeight: "600", lineHeight: 1.6, maxWidth: "280px", margin: "0 auto 24px" }}>
                  Tap the ♡ on any cafe card to save it here for quick access.
                </div>
                <button
                  onClick={() => changeView("leaderboard")}
                  style={{
                    padding: "12px 24px", borderRadius: "999px",
                    background: "#c8684a", border: "none", color: "#fff",
                    fontSize: "13px", fontWeight: "800", cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 4px 14px rgba(200,104,74,0.35)",
                  }}
                >Browse cafes →</button>
              </div>
            );
            const allCafes = getAllCafes(entries);
            const saved = allCafes.filter(c => savedCafes.has(`${c.cafe}||${c.suburb}`));
            // Also include any saved keys that no longer have data (removed from index)
            const savedKeys = [...savedCafes];
            const missingKeys = savedKeys.filter(k => !saved.find(c => `${c.cafe}||${c.suburb}` === k));
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "13px", color: "#b0a090", fontWeight: "600", marginBottom: "4px" }}>
                  {saved.length} saved cafe{saved.length !== 1 ? "s" : ""}
                </div>
                {saved.map(c => (
                  <CafeCard
                    key={`${c.cafe}||${c.suburb}`}
                    cafe={c.cafe}
                    suburb={c.suburb}
                    price={c.avg}
                    vibes={[]}
                    latestEntryId={c.latestEntryId}
                    lastConfirmed={c.lastConfirmed}
                    onConfirm={confirmPrice}
                    saved={true}
                    onToggleSave={toggleSave}
                    onLog={() => {
                      setForm({ suburb: c.suburb, cafe: c.cafe, price: "", address: "", vibes: [], name: "", email: "" });
                      setCafeSearch("");
                      changeView("submit");
                    }}
                  />
                ))}
                {missingKeys.length > 0 && (
                  <div style={{ marginTop: "8px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#c8b8a8", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "8px" }}>
                      No price data yet
                    </div>
                    {missingKeys.map(k => {
                      const [cafeName, sub] = k.split("||");
                      return (
                        <div key={k} style={{ ...CARD, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e1a14" }}>{cafeName}</div>
                            <div style={{ fontSize: "12px", color: "#b0a090", fontWeight: "600", marginTop: "2px" }}>📍 {sub}</div>
                          </div>
                          <button
                            onClick={() => toggleSave(cafeName, sub)}
                            style={{
                              background: "#fff0eb", border: "1.5px solid #f0d4c0", borderRadius: "50%",
                              width: "34px", height: "34px", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "16px", color: "#c8684a", flexShrink: 0,
                            }}
                          >♥</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* SUBMIT */}
          {renderedView === "submit" && (
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
                    <select className="cs-input" value={form.suburb} onChange={e => {
                      setForm({ suburb: e.target.value, cafe: "", price: form.price, address: "", vibes: [], name: form.name });
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
                            className="cs-input"
                            placeholder={`Search cafes in ${form.suburb}...`}
                            value={cafeSearch}
                            onChange={e => setCafeSearch(e.target.value)}
                            style={{ ...inputStyle, marginBottom: "6px" }}
                            autoComplete="off"
                          />
                          <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                            {filteredCafes.length === 0 && !cafeSearch && (
                              <div style={{ padding: "12px", textAlign: "center", color: "#c8b8a8", fontSize: "13px", fontWeight: "600" }}>
                                No cafes found
                              </div>
                            )}
                            {filteredCafes.map((c, i) => (
                              <div key={i}
                                onClick={() => { setForm({ ...form, cafe: c.name, address: c.address }); setCafeSearch(""); }}
                                style={{ padding: "10px 12px", borderRadius: "10px", cursor: "pointer", marginBottom: "2px" }}
                                onMouseEnter={e => e.currentTarget.style.background = "#faf6f0"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#1e1a14" }}>{c.name}</span>
                                  {c.inIndex && (
                                    <span style={{ fontSize: "10px", fontWeight: "800", color: "#c8684a", background: "#fff3e8", border: "1px solid #f0d4c0", borderRadius: "999px", padding: "1px 7px", flexShrink: 0 }}>in index</span>
                                  )}
                                </div>
                                {c.address && <div style={{ fontSize: "11px", color: "#b0a090", marginTop: "1px" }}>{c.address}</div>}
                              </div>
                            ))}
                            {/* Add manually if not found */}
                            {cafeSearch && !mergedCafes.find(c => c.name.toLowerCase() === cafeSearch.toLowerCase()) && (
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
                      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
                        {["4.00", "4.50", "5.00", "5.50", "6.00", "6.50"].map(p => (
                          <button key={p} onClick={() => setForm({ ...form, price: p })} style={{
                            padding: "7px 13px", borderRadius: "999px",
                            border: form.price === p ? "2px solid #c8684a" : "2px solid #ede5d8",
                            background: form.price === p ? "#c8684a" : "#ffffff",
                            color: form.price === p ? "#ffffff" : "#a09080",
                            fontSize: "13px", fontWeight: "700", cursor: "pointer",
                            fontFamily: "inherit", transition: "all 0.12s",
                          }}>
                            ${p}
                          </button>
                        ))}
                      </div>
                      <input
                        className="cs-input"
                        type="number" placeholder="or type a price..." step="0.10" min="0.50" max="20"
                        inputMode="decimal"
                        value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {/* Step 4: Name */}
                  {form.cafe && form.price && (
                    <div style={{ marginBottom: "18px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px", color: "#b0a090", textTransform: "uppercase", marginBottom: "8px" }}>
                        Your name or handle <span style={{ color: "#d4c4b4", fontWeight: "600", textTransform: "none", letterSpacing: 0 }}>— optional</span>
                      </div>
                      <input
                        className="cs-input"
                        type="text"
                        placeholder="e.g. Sam, @coffeefiend (optional)"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        style={inputStyle}
                        maxLength={60}
                      />
                    </div>
                  )}

                  {/* Step 4b: Email */}
                  {form.cafe && form.price && (
                    <div style={{ marginBottom: "18px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px", color: "#b0a090", textTransform: "uppercase", marginBottom: "8px" }}>
                        Stay in the loop <span style={{ color: "#d4c4b4", fontWeight: "600", textTransform: "none", letterSpacing: 0 }}>— optional</span>
                      </div>
                      <input
                        className="cs-input"
                        type="email"
                        placeholder="your@email.com"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        style={inputStyle}
                        maxLength={254}
                      />
                      <div style={{ fontSize: "11px", color: "#c8b8a8", fontWeight: "600", marginTop: "6px", lineHeight: 1.5 }}>
                        We'll let you know when Coffee Spot launches properly and hits new milestones.
                      </div>
                    </div>
                  )}

                  {/* Step 5: Vibes */}
                  {form.cafe && form.price && (
                    <div style={{ marginBottom: "18px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px", color: "#b0a090", textTransform: "uppercase", marginBottom: "8px" }}>
                        Vibe <span style={{ color: "#d4c4b4", fontWeight: "600", textTransform: "none", letterSpacing: 0 }}>— optional</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {VIBES.map(v => {
                          const active = form.vibes.includes(v.id);
                          return (
                            <button
                              key={v.id}
                              onClick={() => setForm(f => ({
                                ...f,
                                vibes: active ? f.vibes.filter(x => x !== v.id) : [...f.vibes, v.id]
                              }))}
                              style={{
                                padding: "7px 12px", borderRadius: "999px", cursor: "pointer",
                                fontFamily: "inherit", fontSize: "12px", fontWeight: "700",
                                border: `1.5px solid ${active ? v.border : "#ede5d8"}`,
                                background: active ? v.bg : "#ffffff",
                                color: active ? v.color : "#a09080",
                                transition: "all 0.12s",
                              }}
                            >
                              {v.emoji} {v.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {showPriceWarning ? (
                    <div style={{
                      marginTop: "8px", padding: "16px 18px", borderRadius: "16px",
                      background: "#fff8f0", border: "1.5px solid #f0d4c0",
                      animation: "fadeSlideIn 0.2s ease",
                    }}>
                      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "14px" }}>
                        <span style={{ fontSize: "20px", flexShrink: 0 }}>⚠️</span>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e1a14", marginBottom: "4px" }}>
                            Price looks a bit different
                          </div>
                          <div style={{ fontSize: "13px", color: "#786450", fontWeight: "600", lineHeight: 1.5 }}>
                            This price looks different from what we have on record. Are you sure?
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={doSubmit}
                          disabled={submitting}
                          style={{
                            flex: 1, padding: "11px", borderRadius: "999px",
                            background: "#c8684a", border: "none", color: "#ffffff",
                            fontSize: "13px", fontWeight: "800", cursor: "pointer",
                            fontFamily: "inherit", opacity: submitting ? 0.6 : 1,
                            boxShadow: "0 3px 10px rgba(200,104,74,0.3)",
                          }}
                        >
                          {submitting ? "Submitting..." : "Yes, submit"}
                        </button>
                        <button
                          onClick={() => setShowPriceWarning(false)}
                          style={{
                            flex: 1, padding: "11px", borderRadius: "999px",
                            background: "transparent", border: "1.5px solid #ede5d8",
                            color: "#a09080", fontSize: "13px", fontWeight: "700",
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                      {submitError && (
                        <div style={{ marginTop: "10px", padding: "10px 14px", borderRadius: "12px", background: "rgba(224,80,80,0.08)", border: "1.5px solid rgba(224,80,80,0.2)" }}>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "#e05050" }}>⚠ {submitError}</div>
                        </div>
                      )}
                      <div style={{ textAlign: "center", marginTop: "12px", fontSize: "12px", fontWeight: "600", color: submitHint ? "#c8684a" : "#d4c4b4", minHeight: "18px" }}>
                        {submitHint ?? "No account needed. Just the vibe."}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp share — floating pill, bottom-right */}
      <a
        href={`https://wa.me/?text=${encodeURIComponent("Check out Coffee Spot — tracks real flat white prices at Melbourne cafes 🔍☕ flatwhite-index.vercel.app")}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "11px 18px 11px 14px",
          borderRadius: "999px",
          background: "#ffffff",
          border: "1.5px solid #ede5d8",
          boxShadow: "0 4px 18px rgba(0,0,0,0.10)",
          textDecoration: "none",
          zIndex: 100,
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.13)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.10)";
        }}
      >
        {/* WhatsApp icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span style={{
          fontSize: "13px",
          fontWeight: "800",
          color: "#786450",
          fontFamily: "'Nunito', system-ui, sans-serif",
          letterSpacing: "0.1px",
        }}>Share</span>
      </a>

    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 16px", borderRadius: "14px",
  background: "#faf6f0", border: "1.5px solid #ede5d8",
  color: "#1e1a14", fontSize: "14px", fontFamily: "'Nunito', system-ui, sans-serif",
  fontWeight: "600", boxSizing: "border-box",
  appearance: "none", WebkitAppearance: "none",
  transition: "border-color 0.15s, box-shadow 0.15s"
};
