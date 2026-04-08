import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { KNOWN_CAFES, VIBES, haversine, formatDist } from "./utils";

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

const pinColor = (price) => {
  if (price < 5.00) return { fill: "#3aaa6a", stroke: "#2a8a52", bg: "#edfaf3", text: "#2a7a4a" };
  if (price <= 5.50) return { fill: "#d4a030", stroke: "#b08020", bg: "#fdf7e0", text: "#a07020" };
  return { fill: "#e05050", stroke: "#c03030", bg: "#fef0f0", text: "#c03030" };
};

const createCircleIcon = (color) => L.divIcon({
  className: "",
  html: `<div style="
    width: 22px; height: 22px; border-radius: 50%;
    background: ${color.fill};
    border: 3px solid ${color.stroke};
    box-shadow: 0 2px 8px rgba(0,0,0,0.25), 0 0 0 2px rgba(255,255,255,0.6);
    box-sizing: border-box;
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
});

// Aggregate entries into per-cafe summaries with stable jittered latlngs
const buildCafeList = (entries, jitterCache) => {
  const map = {};
  entries.forEach(e => {
    const key = `${e.cafe}||${e.suburb}`;
    if (!map[key]) map[key] = { cafe: e.cafe, suburb: e.suburb, prices: [], vibes: new Set() };
    map[key].prices.push(Number(e.price));
    if (Array.isArray(e.vibes)) e.vibes.forEach(v => map[key].vibes.add(v));
  });
  return Object.values(map).map(c => {
    const known = KNOWN_CAFES.find(k => k.name === c.cafe);
    let latlng;
    if (known) {
      latlng = [known.lat, known.lng];
    } else {
      const sub = SUBURB_LATLNG[c.suburb];
      if (!sub) return null;
      const cacheKey = `${c.cafe}||${c.suburb}`;
      if (!jitterCache[cacheKey]) {
        jitterCache[cacheKey] = [sub[0] + (Math.random() - 0.5) * 0.004, sub[1] + (Math.random() - 0.5) * 0.004];
      }
      latlng = jitterCache[cacheKey];
    }
    return {
      cafe: c.cafe,
      suburb: c.suburb,
      avg: c.prices.reduce((a, b) => a + b, 0) / c.prices.length,
      count: c.prices.length,
      vibes: [...c.vibes],
      latlng,
    };
  }).filter(Boolean);
};

const buildPopupHtml = (cafe, suburb, avg, count, vibes, userPos, latlng) => {
  const col = pinColor(avg);

  const distHtml = userPos
    ? (() => {
        const m = haversine(userPos.lat, userPos.lng, latlng[0], latlng[1]);
        return `<div style="
          display:inline-flex; align-items:center; gap:4px;
          font-size:11px; font-weight:700; color:#7a9a30;
          background:#f4fae0; border:1px solid #d4e8a0;
          border-radius:999px; padding:3px 10px; margin-bottom:8px;
        ">📍 ${formatDist(m)} away</div>`;
      })()
    : "";

  const vibeLabels = vibes
    .map(id => VIBES.find(v => v.id === id))
    .filter(Boolean)
    .map(v => `<span style="
      display:inline-flex; align-items:center; gap:3px;
      background:${v.bg}; color:${v.color}; border:1px solid ${v.border};
      border-radius:999px; padding:2px 8px; font-size:11px; font-weight:700;
    ">${v.emoji} ${v.label}</span>`)
    .join("");

  return `
    <div style="font-family:Nunito,system-ui,sans-serif; min-width:160px; max-width:220px;">
      <div style="font-size:14px; font-weight:800; color:#1e1a14; line-height:1.2; margin-bottom:3px;">
        ${cafe}
      </div>
      <div style="font-size:11px; color:#b0a090; font-weight:600; margin-bottom:8px;">
        ${suburb}
      </div>
      ${distHtml}
      <div style="
        display:inline-block;
        background:${col.bg}; color:${col.text};
        border:1.5px solid ${col.fill}44;
        border-radius:999px; padding:4px 12px;
        font-size:15px; font-weight:800;
        margin-bottom:${vibeLabels ? "10px" : "4px"};
      ">
        $${avg.toFixed(2)}
        <span style="font-size:10px; font-weight:600; opacity:0.7; margin-left:3px;">
          (${count} report${count !== 1 ? "s" : ""})
        </span>
      </div>
      ${vibeLabels ? `<div style="display:flex; flex-wrap:wrap; gap:4px;">${vibeLabels}</div>` : ""}
    </div>
  `;
};

export default function MapView({ entries }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const jitterCache = useRef({});
  const [userPos, setUserPos] = useState(null);
  const [locState, setLocState] = useState("idle"); // idle | loading | done | denied

  // Request location once on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocState("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserPos({ lat: coords.latitude, lng: coords.longitude });
        setLocState("done");
      },
      () => setLocState("denied"),
      { timeout: 8000 }
    );
  }, []);

  // Mount map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-37.8136, 144.9631],
      zoom: 13,
      zoomControl: true,
    });
    mapRef.current = map;
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Rebuild markers when entries or userPos changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });

    const cafes = buildCafeList(entries, jitterCache.current);
    cafes.forEach(({ cafe, suburb, avg, count, vibes, latlng }) => {
      const col = pinColor(avg);
      const icon = createCircleIcon(col);
      const popup = L.popup({ className: "coffee-popup", maxWidth: 250, closeButton: true })
        .setContent(buildPopupHtml(cafe, suburb, avg, count, vibes, userPos, latlng));
      L.marker(latlng, { icon }).bindPopup(popup).addTo(map);
    });

    // Show user's location dot if available
    if (userPos) {
      L.circleMarker([userPos.lat, userPos.lng], {
        radius: 7,
        fillColor: "#4a6aaa",
        fillOpacity: 1,
        color: "#fff",
        weight: 2.5,
      }).bindTooltip("You are here", { direction: "top", offset: [0, -8] }).addTo(map);
    }
  }, [entries, userPos]);

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "420px",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1.5px solid #ede5d8",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      />

      {/* Legend + location status row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          {[
            { color: "#3aaa6a", label: "Under $5.00" },
            { color: "#d4a030", label: "$5.00 – $5.50" },
            { color: "#e05050", label: "Over $5.50" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "12px", height: "12px", borderRadius: "50%",
                background: color, border: `2px solid ${color}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#b0a090" }}>{label}</span>
            </div>
          ))}
        </div>

        {locState === "loading" && (
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#b0a090" }}>📍 Finding you…</span>
        )}
        {locState === "denied" && (
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#c8b8a8" }}>📍 Location unavailable</span>
        )}
        {locState === "done" && (
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#7a9a30" }}>📍 Showing distances from you</span>
        )}
      </div>

      <div style={{
        textAlign: "center", marginTop: "12px", padding: "10px 16px",
        background: "#fff3e8", borderRadius: "12px",
        fontSize: "12px", color: "#c8684a", fontWeight: "700",
      }}>
        👆 Tap a pin to see cafe details
      </div>
    </div>
  );
}
