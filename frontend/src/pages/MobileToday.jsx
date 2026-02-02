import { useEffect, useState, useMemo } from "react";
import { jwtDecode } from "jwt-decode";
import LoginPopup from "../components/LoginPopup";
import { getToken, setToken, clearToken } from "../utils/authUtils";
import "../styles/MobileToday.css";
import "../styles/LoginPopup.css";

export default function MobileToday() {
  const [reservations, setReservations] = useState([]);
  const [filter, setFilter] = useState("all");

  // Login-States
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [role, setRole] = useState(null);

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

  // Reservationen laden
  useEffect(() => {
    fetch(`${API_URL}/api/reservations`)
      .then((res) => {
        if (!res.ok) throw new Error(`Serverfehler: ${res.status}`);
        return res.json();
      })
      .then((data) => setReservations(data))
      .catch((err) =>
        console.error("Fehler beim Laden der Reservationen:", err.message),
      );
  }, [API_URL]);

  // Token beim Start lesen (falls bereits eingeloggt)
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);

      if (decoded?.exp && decoded.exp > now) {
        setLoggedInUser(decoded.username || null);
        setRole(decoded.role || null);
      } else {
        clearToken();
      }
    } catch {
      clearToken();
    }
  }, []);

  const handleLogin = () => {
    fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginData),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Login fehlgeschlagen");
        const data = await res.json();

        // Token speichern
        setToken(data.token, rememberMe);

        // UI-Status setzen (ohne reload)
        setLoggedInUser(data.username || null);
        setRole(data.role || null);

        setLoginData({ username: "", password: "" });
        setShowLoginPopup(false);
      })
      .catch(() => alert("❌ Ungültiger Login"));
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setRole(null);
    clearToken();
  };

  const today = new Date();
  const todayStr = today.toLocaleDateString("de-CH");

  const filtered = useMemo(() => {
    const now = new Date();

    return reservations
      .filter((r) => {
        const start = new Date(r.start);
        const end = new Date(r.end);

        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);

        const overlapsToday = start <= endOfToday && end >= startOfToday;
        if (!overlapsToday) return false;

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

        return new Date(a.start) - new Date(b.start);
      });
  }, [reservations, filter, today]);

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

  const canManual = !!role && role !== "guest";

  return (
    <>
      <header className="mobiletoday-header">
        <div className="mobiletoday-head-left">
          <h1 className="mobiletoday-title">Heutige Reservationen</h1>
          <div className="mobiletoday-date">{todayStr}</div>
        </div>

        <div className="mobiletoday-head-right">
          {!loggedInUser ? (
            <button
              className="mobiletoday-login-btn"
              type="button"
              onClick={() => setShowLoginPopup(true)}
              aria-label="Anmelden"
              title="Anmelden"
            >
              Anmelden
            </button>
          ) : (
            <div className="mobiletoday-user">
              <span className="mobiletoday-user-name">{loggedInUser}</span>
              <button
                className="mobiletoday-logout-btn"
                type="button"
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mobiletoday-container">
        <div className="mobiletoday-filters">
          <button
            className={`mobiletoday-filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Alle
          </button>
          <button
            className={`mobiletoday-filter-btn ${filter === "active" ? "active" : ""}`}
            onClick={() => setFilter("active")}
          >
            Laufende
          </button>
          <button
            className={`mobiletoday-filter-btn ${filter === "future" ? "active" : ""}`}
            onClick={() => setFilter("future")}
          >
            Spätere
          </button>
          <button
            className={`mobiletoday-filter-btn ${filter === "past" ? "active" : ""}`}
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
                className={`mobiletoday-entry ${getStatusClass(res.start, res.end)}`}
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

      {/* Floating + Button nach Login */}
      {canManual && (
        <button
          className="mobiletoday-fab"
          type="button"
          onClick={() =>
            (window.location.href =
              "/reservations/manual?return=" + encodeURIComponent("/mobile"))
          }
          aria-label="Manuelle Reservation"
          title="Manuelle Reservation"
        >
          +
        </button>
      )}

      {/* Login Popup (wie Home) */}
      <LoginPopup
        open={showLoginPopup}
        onClose={() => setShowLoginPopup(false)}
        loginData={loginData}
        setLoginData={setLoginData}
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
        onLogin={handleLogin}
        onHelp={() => (window.location.href = "/help")}
      />
    </>
  );
}
