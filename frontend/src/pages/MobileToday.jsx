// src/pages/MobileToday.jsx
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

        // Nur Reservationen für **heute**
        const sameDay =
          start.toDateString() === today.toDateString() ||
          end.toDateString() === today.toDateString();

        if (!sameDay) return false;

        if (filter === "active") return start <= now && end >= now;
        if (filter === "future") return start > now;
        if (filter === "past") return end < now;
        return true; // all
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [reservations, filter]);

  const getStatusClass = (startStr, endStr) => {
    const now = new Date();
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (start > now) return "future"; // grün
    if (end < now) return "past"; // grau
    return "active"; // orange
  };

  return (
    <>
      <header>
        <h1>Heutige Reservationen</h1>
        <div className="today-date">{todayStr}</div>
      </header>

      <div className="mobile-container">
        <div className="filter-buttons">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Alle
          </button>
          <button
            className={filter === "active" ? "active" : ""}
            onClick={() => setFilter("active")}
          >
            Laufende
          </button>
          <button
            className={filter === "future" ? "active" : ""}
            onClick={() => setFilter("future")}
          >
            Spätere
          </button>
          <button
            className={filter === "past" ? "active" : ""}
            onClick={() => setFilter("past")}
          >
            Vorbei
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="no-results">Keine Reservationen gefunden.</div>
        ) : (
          <div className="reservations-list">
            {filtered.map((res) => (
              <div
                key={res.id}
                className={`reservation ${getStatusClass(res.start, res.end)}`}
              >
                <h3>{res.tool.name}</h3>
                <p>
                  <strong>Von:</strong> {res.user.first_name || ""}{" "}
                  {res.user.last_name || ""}
                </p>
                <p>
                  <strong>Start:</strong> {res.start}
                </p>
                <p>
                  <strong>Ende:</strong> {res.end}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
