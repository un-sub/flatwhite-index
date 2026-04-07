import { useState, useEffect } from "react";
import App from "./App";
import Landing from "./Landing";

const getPage = () => {
  const h = window.location.hash;
  return h === "#app" || h === "#near-me" || h === "#map" ? "app" : "landing";
};

export default function Router() {
  const [page, setPage] = useState(getPage);

  useEffect(() => {
    const onHash = () => setPage(getPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return page === "app" ? <App /> : <Landing />;
}
