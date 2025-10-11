import { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";

// Styles im Look&Feel der bestehenden Seiten
import "../styles/Home.css";
import "../styles/ManualReservations.css"; // NEU

function ManuelReservations() {
  const [query, setQuery] = useState("");
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [message, setMessage] = useState("");

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

  const fetchWithAuth = (url, options = {}) => {
    const token = localStorage.getItem("token");
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  const loggedInUser = useMemo(() => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch {
      return null;
    }
  }, []);

  const loadTools = async (q = "") => {
    setLoading(true);
    try {
      const url = `${API_URL}/api/tools/public?query=${encodeURIComponent(q)}&limit=200`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fehler beim Laden der Werkzeuge");
      const data = await res.json();
      setTools(Array.isArray(data) ? data : []);
    } catch (e) {
      setTools([]);
      setMessage(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools("");
  }, []);

  const openDuration = (tool) => {
    setSelectedTool(tool);
  };

  const closeDuration = () => {
    setSelectedTool(null);
  };

  const createReservation = async (days) => {
    if (!selectedTool) return;
    const payload = {
      tool: selectedTool.qr_code, // Tool kommt aus Tabelle
      duration: days,
      // Benutzer NICHT mitsenden → Backend soll per JWT (current user) ableiten
      // Falls euer Backend das noch nicht kann, bitte im Reservations-POST ergänzen.
    };

    try {
      const res = await fetchWithAuth(`${API_URL}/api/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Reservation fehlgeschlagen");
      }

      setMessage(`✅ Reservation erstellt: ${selectedTool.name} für ${days} Tag(e)`);
      setSelectedTool(null);

      // Nach Sync kurz Liste aktualisieren (z. B. falls Tool nun ausgeliehen ist)
      loadTools(query);
      // Optional: globaler Refresh-Event, falls Kalender auf anderer Seite offen
      window.dispatchEvent(new CustomEvent("scanventory:reservations:refresh"));
    } catch (e) {
      setMessage(`❌ ${e.message}`);
    }
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();
    loadTools(query.trim());
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>Manuelle Reservation</h1>
        <div className="login-info">
          {loggedInUser ? (
            <div className="user-label">
              Angemeldet als: <strong>{loggedInUser.username}</strong>
            </div>
          ) : (
            <div className="user-label">
              <strong>Nicht angemeldet</strong>
            </div>
          )}
          <div className="login-actions">
            <button onClick={() => (window.location.href = "/")}>Zurück</button>
          </div>
        </div>
      </header>

      <section className="manualres-controls">
        <form onSubmit={onSearchSubmit} className="manualres-searchrow">
          <input
            type="text"
            className="manualres-search"
            placeholder="Werkzeug suchen (Name, QR, Kategorie)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Laden…" : "Suchen"}
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              loadTools("");
            }}
            disabled={loading}
          >
            Reset
          </button>
        </form>

        {message && <div className="manualres-message">{message}</div>}
      </section>

      <section className="manualres-tablewrap">
        <table className="manualres-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>QR-Code</th>
              <th>Kategorie</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="tcenter">
                  Lädt…
                </td>
              </tr>
            ) : tools.length === 0 ? (
              <tr>
                <td colSpan={5} className="tcenter">
                  Keine Werkzeuge gefunden.
                </td>
              </tr>
            ) : (
              tools.map((t) => {
                const statusLabel = t.is_borrowed
                  ? "ausgeliehen"
                  : t.status || "verfügbar";

                return (
                  <tr key={t.id} className={t.is_borrowed ? "row-busy" : ""}>
                    <td title={t.name}>{t.name}</td>
                    <td>{t.qr_code}</td>
                    <td>{t.category || "-"}</td>
                    <td className={`status ${t.is_borrowed ? "busy" : "free"}`}>
                      {statusLabel}
                    </td>
                    <td>
                      <button
                        disabled={t.is_borrowed}
                        onClick={() => openDuration(t)}
                        title={
                          t.is_borrowed
                            ? "Werkzeug ist aktuell ausgeliehen"
                            : "Reservieren"
                        }
                      >
                        Reservieren
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Dauer-Auswahl (Modal) */}
      {selectedTool && (
        <div
          className="duration-overlay"
          onClick={(e) => {
            if (e.target.classList.contains("duration-overlay")) {
              closeDuration(); // Abbruch → zurück zur Tabelle
            }
          }}
        >
          <div className="duration-modal">
            <h3 className="duration-title">
              Dauer wählen – {selectedTool.name} ({selectedTool.qr_code})
            </h3>

            <div className="duration-grid">
              {[1, 2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  className="duration-tile"
                  onClick={() => createReservation(d)}
                >
                  <span className="duration-tile-label">
                    {d} Tag{d > 1 ? "e" : ""}
                  </span>
                </button>
              ))}
            </div>

            <div className="duration-actions">
              <button onClick={closeDuration}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManuelReservations;
