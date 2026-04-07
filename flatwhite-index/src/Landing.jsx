import { useState } from "react";
import { query, KNOWN_CAFES, haversine, formatDist, CARD } from "./utils";

export default function Landing() {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [results, setResults] = useState([]);

  const findNearMe = () => {
    if (!navigator.geolocation) { setState("error"); return; }
    setState("loading");

    Promise.all([
      query("/prices?select=cafe,price"),
      new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      ),
    ]).then(([entries, pos]) => {
      const { latitude, longitude } = pos.coords;
      const priceMap = {};
      (entries || []).forEach(e => {
        if (!priceMap[e.cafe]) priceMap[e.cafe] = [];
        priceMap[e.cafe].push(Number(e.price));
      });
      const top3 = KNOWN_CAFES
        .map(cafe => {
          const dist = haversine(latitude, longitude, cafe.lat, cafe.lng);
          const prices = priceMap[cafe.name] || [];
          const avgPrice = prices.length
            ? prices.reduce((a, b) => a + b, 0) / prices.length
            : null;
          return { ...cafe, dist, avgPrice };
        })
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3);
      setResults(top3);
      setState("done");
    }).catch(() => setState("error"));
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#faf6f0",
      fontFamily: "'Nunito', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: state === "done" ? "flex-start" : "center",
      padding: state === "done" ? "48px 16px 80px" : "24px 16px",
      textAlign: "center",
      transition: "justify-content 0.3s ease",
    }}>

      {/* Brand */}
      <div style={{ fontSize: state === "done" ? "36px" : "52px", marginBottom: state === "done" ? "10px" : "20px", transition: "font-size 0.3s ease" }}>☕</div>

      <h1 style={{
        fontSize: state === "done" ? "clamp(24px, 6vw, 38px)" : "clamp(38px, 11vw, 68px)",
        fontWeight: "800",
        lineHeight: 1.05,
        color: "#1e1a14",
        letterSpacing: "-1px",
        margin: "0 0 12px",
        maxWidth: "520px",
        transition: "font-size 0.3s ease",
      }}>
        {state === "done" ? "Your 3 nearest coffees" : <>Great coffee,{" "}<span style={{ color: "#c8684a", fontStyle: "italic" }}>near you.</span></>}
      </h1>

      {state !== "done" && (
        <>
          <p style={{
            fontSize: "17px",
            color: "#a09080",
            fontWeight: "600",
            maxWidth: "400px",
            lineHeight: 1.65,
            margin: "0 0 16px",
          }}>
            Community-reported flat white prices at Melbourne's best cafes.
          </p>
          <p style={{
            fontSize: "14px",
            color: "#c8b8a8",
            fontWeight: "600",
            maxWidth: "360px",
            lineHeight: 1.7,
            margin: "0 0 36px",
          }}>
            Our goal is to map <strong style={{ color: "#a09080" }}>every cafe in Melbourne</strong> — one flat white at a time. Find the best cup near you, or help us grow the index.
          </p>
        </>
      )}

      {/* Idle: CTAs */}
      {state === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <button
            onClick={findNearMe}
            style={{
              padding: "20px 48px",
              borderRadius: "999px",
              background: "#c8684a",
              border: "none",
              color: "#ffffff",
              fontSize: "19px",
              fontWeight: "800",
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 8px 28px rgba(200,104,74,0.45)",
              letterSpacing: "0.2px",
              transition: "transform 0.15s, box-shadow 0.15s",
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 12px 36px rgba(200,104,74,0.55)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 28px rgba(200,104,74,0.45)";
            }}
          >
            <span>📍</span> Show me my 3 closest coffees
          </button>
          <button
            onClick={() => { window.location.hash = "#app"; }}
            style={{
              padding: "13px 28px",
              borderRadius: "999px",
              background: "transparent",
              border: "1.5px solid #ede5d8",
              color: "#a09080",
              fontSize: "14px",
              fontWeight: "700",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8684a"; e.currentTarget.style.color = "#c8684a"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede5d8"; e.currentTarget.style.color = "#a09080"; }}
          >
            Browse the full index →
          </button>
        </div>
      )}

      {/* Loading */}
      {state === "loading" && (
        <div style={{ margin: "8px 0 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "50%",
            border: "3px solid #f0d4c0", borderTopColor: "#c8684a",
            animation: "spin 0.85s linear infinite",
          }} />
          <div style={{ fontSize: "15px", color: "#a09080", fontWeight: "700" }}>Finding your nearest cafes...</div>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "14px", color: "#e05050", fontWeight: "700", marginBottom: "16px" }}>
            Couldn't get your location — check browser permissions and try again.
          </div>
          <button
            onClick={findNearMe}
            style={{
              padding: "14px 32px", borderRadius: "999px",
              background: "#c8684a", border: "none", color: "#fff",
              fontSize: "15px", fontWeight: "800", cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 6px 20px rgba(200,104,74,0.4)",
            }}
          >Try again</button>
        </div>
      )}

      {/* Results */}
      {state === "done" && (
        <div style={{ width: "100%", maxWidth: "560px", animation: "fadeSlideIn 0.35s ease" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {results.map((cafe, i) => (
              <div
                key={cafe.name}
                style={{ ...CARD, padding: "18px 18px 14px", position: "relative", overflow: "hidden", textAlign: "left", animation: `fadeSlideIn 0.3s ease ${i * 60}ms both` }}
              >
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
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#c8684a", marginTop: "4px" }}>📏 {formatDist(cafe.dist)}</div>
                  </div>
                  {cafe.avgPrice !== null ? (
                    <div style={{
                      background: "#fff3e8", color: "#c8684a", fontWeight: "800", fontSize: "17px",
                      padding: "6px 14px", borderRadius: "999px", flexShrink: 0, border: "1.5px solid #f0d4c0",
                    }}>
                      ${cafe.avgPrice.toFixed(2)}
                    </div>
                  ) : (
                    <div style={{
                      background: "#f4ede6", color: "#c8b8a8", fontWeight: "700", fontSize: "13px",
                      padding: "6px 14px", borderRadius: "999px", flexShrink: 0, border: "1.5px solid #ede5d8",
                    }}>
                      No data
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>

          {/* Browse buttons */}
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => { window.location.hash = "#app"; }}
              style={{
                padding: "14px 28px", borderRadius: "999px",
                background: "#c8684a", border: "none",
                color: "#ffffff", fontSize: "14px", fontWeight: "800",
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 16px rgba(200,104,74,0.35)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(200,104,74,0.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(200,104,74,0.35)"; }}
            >
              ☕ Browse the full index
            </button>
            <button
              onClick={() => { window.location.hash = "#map"; }}
              style={{
                padding: "14px 28px", borderRadius: "999px",
                background: "transparent", border: "1.5px solid #ede5d8",
                color: "#a09080", fontSize: "14px", fontWeight: "700",
                cursor: "pointer", fontFamily: "inherit",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8684a"; e.currentTarget.style.color = "#c8684a"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede5d8"; e.currentTarget.style.color = "#a09080"; }}
            >
              🗺 Browse map
            </button>
          </div>

          {/* Retry link */}
          <button
            onClick={findNearMe}
            style={{
              marginTop: "16px", background: "none", border: "none",
              color: "#c8b8a8", fontSize: "12px", fontWeight: "700",
              cursor: "pointer", fontFamily: "inherit",
              textDecoration: "underline", textUnderlineOffset: "3px",
            }}
          >Search again</button>
        </div>
      )}

      {/* Trust strip — only on idle */}
      {state === "idle" && (
        <div style={{
          display: "flex", gap: "20px", marginTop: "48px",
          fontSize: "12px", color: "#c8b8a8", fontWeight: "700",
          flexWrap: "wrap", justifyContent: "center",
        }}>
          {["No account needed", "Real prices", "Melbourne locals"].map(t => (
            <span key={t}>✓ {t}</span>
          ))}
        </div>
      )}

    </div>
  );
}
