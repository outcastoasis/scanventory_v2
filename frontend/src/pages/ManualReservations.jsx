//frontend/src/pages/ManualReservations
import { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import ReservationPopup from "../components/ReservationPopup";
import { getToken } from "../utils/authUtils";

import "../styles/Home.css";
import "../styles/ManualReservations.css";

function ManualReservations() {
  const [query, setQuery] = useState("");
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [popupOpen, setPopupOpen] = useState(false);
  const [popupData, setPopupData] = useState(null);

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

  const fetchWithAuth = (url, options = {}) => {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  const loggedInUser = useMemo(() => {
    const token = getToken();
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch {
      return null;
    }
  }, []);

  const currentUser = useMemo(
    () =>
      loggedInUser
        ? {
            id: loggedInUser.id,
            username: loggedInUser.username,
            role: loggedInUser.role,
          }
        : { role: "guest" },
    [loggedInUser]
  );

  const loadTools = async (q = "") => {
    setLoading(true);
    try {
      const url = `${API_URL}/api/tools/public?query=${encodeURIComponent(
        q
      )}&limit=200`;
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

  const openCreatePopup = (tool) => {
    const start = new Date();
    const end = new Date(Date.now() + 60 * 60 * 1000);
    setPopupData({
      user: currentUser,
      tool,
      start,
      end,
      note: "",
    });
    setPopupOpen(true);
  };

  const onSaved = () => {
    setPopupOpen(false);
    setPopupData(null);
    loadTools(query);
    window.dispatchEvent(new CustomEvent("scanventory:reservations:refresh"));
    setMessage("✅ Reservation erstellt.");
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
                        disabled={t.is_borrowed || currentUser.role === "guest"}
                        onClick={() => openCreatePopup(t)}
                        title={
                          t.is_borrowed
                            ? "Werkzeug ist aktuell ausgeliehen"
                            : currentUser.role === "guest"
                            ? "Bitte anmelden"
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

      {popupOpen && (
        <ReservationPopup
          isOpen
          mode="create"
          initialData={popupData}
          currentUser={currentUser}
          onClose={() => setPopupOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

export default ManualReservations;
