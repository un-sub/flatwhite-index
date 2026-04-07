export const SUPABASE_URL = "https://fhcxythnjadmscqlpzgx.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_mHNJsNq7iXHD80PRCwsKmg_2v5i8-gq";

export const query = async (path, options = {}) => {
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

export const formatPrice = (p) => `$${Number(p).toFixed(2)}`;

export const CARD = {
  background: "#ffffff",
  borderRadius: "20px",
  border: "1.5px solid #ede5d8",
  boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
};

export const VIBES = [
  { id: "specialty",  label: "Specialty",       emoji: "☕", color: "#8b5e3c", bg: "#fff0e6", border: "#f5d5b8" },
  { id: "cozy",       label: "Cozy",            emoji: "🌿", color: "#3a7a5a", bg: "#edfaf3", border: "#b8e8cc" },
  { id: "laptop",     label: "Laptop-friendly", emoji: "💻", color: "#4a6aaa", bg: "#eef2fc", border: "#c0cfee" },
  { id: "outdoor",    label: "Outdoor",         emoji: "🌞", color: "#a07020", bg: "#fdf7e0", border: "#ead89a" },
  { id: "quick",      label: "Quick",           emoji: "⚡", color: "#7a5aaa", bg: "#f5eefa", border: "#d4b8f0" },
  { id: "hidden-gem", label: "Hidden gem",      emoji: "💎", color: "#c8684a", bg: "#fff3e8", border: "#f0d4c0" },
  { id: "quiet",      label: "Quiet",           emoji: "🔇", color: "#5a7a8a", bg: "#edf5f8", border: "#b8d8e8" },
  { id: "lively",     label: "Lively",          emoji: "🎶", color: "#a04898", bg: "#faf0fa", border: "#e8c0e8" },
];

export const KNOWN_CAFES = [
  { name: "Patricia Coffee Brewers",  suburb: "CBD",             lat: -37.8142, lng: 144.9632 },
  { name: "Brother Baba Budan",       suburb: "CBD",             lat: -37.8138, lng: 144.9631 },
  { name: "Market Lane Coffee",       suburb: "CBD",             lat: -37.8155, lng: 144.9648 },
  { name: "Axil Coffee Roasters",     suburb: "CBD",             lat: -37.8142, lng: 144.9648 },
  { name: "Higher Ground",            suburb: "CBD",             lat: -37.8112, lng: 144.9558 },
  { name: "Proud Mary",               suburb: "Collingwood",     lat: -37.8027, lng: 144.9789 },
  { name: "Seven Seeds",              suburb: "Carlton",         lat: -37.8021, lng: 144.9654 },
  { name: "Clement Coffee",           suburb: "South Melbourne", lat: -37.8312, lng: 144.9587 },
  { name: "Small Batch Roasting",     suburb: "CBD",             lat: -37.8138, lng: 144.9598 },
  { name: "Acoffee",                  suburb: "Collingwood",     lat: -37.8035, lng: 144.9812 },
  { name: "Contraband Coffee",        suburb: "Brunswick",       lat: -37.7712, lng: 144.9598 },
  { name: "Vacation Coffee",          suburb: "Fitzroy",         lat: -37.7998, lng: 144.9789 },
  { name: "St Ali",                   suburb: "South Melbourne", lat: -37.8298, lng: 144.9571 },
  { name: "Dukes Coffee Roasters",    suburb: "CBD",             lat: -37.8142, lng: 144.9665 },
  { name: "Sensory Lab",              suburb: "CBD",             lat: -37.8148, lng: 144.9638 },
];

// Haversine formula — returns distance in metres
export const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatDist = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
