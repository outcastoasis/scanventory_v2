import { useEffect, useState, useMemo } from "react";
import "../styles/MobileToday.css";

export default function MobileToday() {
  const [reservations, setReservations] = useState([]);
  const [filter, setFilter] = useState("all");

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

  useEffect(() => {
    fetch(`${API_URL}/api/reservations`)
      .then((res) => {
        if (!res.ok) throw new Error(`Serverfehler: ${res.status}`);
        return res.json();
      })
      .then((data) => setReservations(data))
      .catch((err) =>
        console.error("Fehler beim Laden der Reservationen:", err.message)
      );
  }, []);

  const today = new Date();
  const todayStr = today.toLocaleDateString("de-CH");

  const filtered = useMemo(() => {
    const now = new Date();

    return reservations
      .filter((r) => {
        const start = new Date(r.start);
        const end = new Date(r.end);

        const sameDay =
          start.toDateString() === today.toDateString() ||
          end.toDateString() === today.toDateString();

        if (!sameDay) return false;

        if (filter === "active") return start <= now && end >= now;
        if (filter === "future") return start > now;
        if (filter === "past") return end < now;
        return true;
      })
      .sort((a, b) => {
        const now = new Date();
        const getStatus = (r) => {
          const start = new Date(r.start);
          const end = new Date(r.end);
          if (start > now) return 2; // future
          if (end < now) return 3; // past
          return 1; // active
        };

        const statusA = getStatus(a);
        const statusB = getStatus(b);

        if (statusA !== statusB) return statusA - statusB;

        // Innerhalb derselben Kategorie nach Startzeit sortieren
        return new Date(a.start) - new Date(b.start);
      });
  }, [reservations, filter]);

  const getStatusClass = (startStr, endStr) => {
    const now = new Date();
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (start > now) return "mobiletoday-future";
    if (end < now) return "mobiletoday-past";
    return "mobiletoday-active";
  };

  const formatDate = (str) => {
    const d = new Date(str);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  };

  return (
    <>
      <header className="mobiletoday-header">
        <h1 className="mobiletoday-title">Heutige Reservationen</h1>
        <div className="mobiletoday-date">{todayStr}</div>
      </header>

      <div className="mobiletoday-container">
        <div className="mobiletoday-filters">
          <button
            className={`mobiletoday-filter-btn ${
              filter === "all" ? "active" : ""
            }`}
            onClick={() => setFilter("all")}
          >
            Alle
          </button>
          <button
            className={`mobiletoday-filter-btn ${
              filter === "active" ? "active" : ""
            }`}
            onClick={() => setFilter("active")}
          >
            Laufende
          </button>
          <button
            className={`mobiletoday-filter-btn ${
              filter === "future" ? "active" : ""
            }`}
            onClick={() => setFilter("future")}
          >
            Spätere
          </button>
          <button
            className={`mobiletoday-filter-btn ${
              filter === "past" ? "active" : ""
            }`}
            onClick={() => setFilter("past")}
          >
            Vorbei
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="mobiletoday-empty">Keine Reservationen gefunden.</div>
        ) : (
          <div className="mobiletoday-list">
            {filtered.map((res) => (
              <div
                key={res.id}
                className={`mobiletoday-entry ${getStatusClass(
                  res.start,
                  res.end
                )}`}
              >
                <h3 className="mobiletoday-tool">{res.tool.name}</h3>
                <p>
                  <strong>Von:</strong> {res.user.first_name || ""}{" "}
                  {res.user.last_name || ""}
                </p>
                <p>
                  <strong>Start:</strong> {formatDate(res.start)}
                </p>
                <p>
                  <strong>Ende:</strong> {formatDate(res.end)}
                </p>
              </div>
            ))}
            <div className="mobiletoday-legend">
              <span className="legend-item">
                <span className="legend-color legend-active" /> Laufend
              </span>
              <span className="legend-item">
                <span className="legend-color legend-future" /> Später
              </span>
              <span className="legend-item">
                <span className="legend-color legend-past" /> Vorbei
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
