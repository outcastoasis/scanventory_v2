import { useState, useEffect, useMemo } from "react";
import ScannerHandler from "../components/ScannerHandler";
import CalendarView from "../components/CalendarView";
import StaticQrCodes from "../components/StaticQrCodes";
import { jwtDecode } from "jwt-decode";
import QRCode from "qrcode";
import {
  getToken,
  setToken,
  clearToken,
  isTokenExpired,
} from "../utils/authUtils";

// Styles
import "../styles/Home.css";
import "../styles/DurationPopUp.css";

// Font Awesome
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCog,
  faTools,
  faUser,
  faKey,
  faPlus,
  faSignOutAlt,
} from "@fortawesome/free-solid-svg-icons";

function Home() {
  const [scanState, setScanState] = useState({
    user: null,
    tool: null,
    duration: null,
  });

  const [message, setMessage] = useState("");
  const [reservations, setReservations] = useState([]);
  const [returnMode, setReturnMode] = useState(false);

  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [role, setRole] = useState(null);
  const [rememberMe, setRememberMe] = useState(false);

  const [scannedUser, setScannedUser] = useState(null);
  const [scannedTool, setScannedTool] = useState(null);

  // Für Heute Reserviert Ansicht
  const todayReservations = useMemo(() => {
    const toLocalDate = (s) => new Date(String(s).replace(" ", "T"));

    const computeUserLabel = (u) => {
      if (!u) return "Unbekannt";
      const first = (u.first_name || "").trim();
      const last = (u.last_name || "").trim();
      if (first && last) {
        if (first.toLowerCase() === last.toLowerCase()) return first;
        return `${first} ${last}`;
      }
      let label = (u.display_name || u.username || "").trim();
      label = label.replace(/\s*(?:\(|-|–|—)\s*[^)]*\)?\s*$/i, "");
      return label || "Unbekannt";
    };

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    return (reservations || [])
      .filter((r) => {
        const start = toLocalDate(r.start);
        const end = toLocalDate(r.end);
        return start <= endOfToday && end >= startOfToday;
      })
      .sort((a, b) => {
        const ae = toLocalDate(a.end) - toLocalDate(b.end);
        if (ae !== 0) return ae;
        return (a.tool?.name || "").localeCompare(b.tool?.name || "");
      })
      .map((r) => ({
        ...r,
        _userLabel: computeUserLabel(r.user),
        _toolLabel: r.tool?.name || r.tool?.qr_code || "Unbekannt",
      }));
  }, [reservations]);

  const formatEnd = (s) => {
    const d = new Date(String(s).replace(" ", "T"));
    return d.toLocaleDateString("de-CH");
  };

  const [showDurationModal, setShowDurationModal] = useState(false);

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

  const fetchWithAuth = (url, options = {}) => {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  function DurationQrTile({ days, onPick }) {
    const id = useMemo(
      () => `durqr-${days}-${Math.random().toString(36).slice(2)}`,
      [days]
    );

    useEffect(() => {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      QRCode.toCanvas(canvas, `dur${days}`, { width: 140, margin: 1 }).catch(
        () => {}
      );
    }, [id, days]);

    return (
      <button
        className="duration-tile"
        onClick={() => onPick(days)}
        aria-label={`${days} Tag(e) auswählen`}
        title={`${days} Tag(e) auswählen`}
      >
        <canvas id={id} />
        <span className="duration-tile-label">
          {days} Tag{days > 1 ? "e" : ""}
        </span>
      </button>
    );
  }

  const resetScan = (msg = "") => {
    setScanState({ user: null, tool: null, duration: null });
    setScannedUser(null);
    setScannedTool(null);
    if (msg) setMessage(msg);
  };

  const cancelDurationSelection = () => {
    setShowDurationModal(false);
    setReturnMode(false);
    resetScan("Vorgang abgebrochen. Bitte Benutzer scannen");
  };

  const pickDuration = (days) => handleScan(`dur${days}`);

  const fetchReservations = () => {
    fetchWithAuth(`${API_URL}/api/reservations`)
      .then((res) => res.json())
      .then((data) => setReservations(data))
      .catch(() => console.error("Fehler beim Laden der Reservationen"));
  };

  const handleLogin = () => {
    fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginData),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Login fehlgeschlagen");
        return res.json();
      })
      .then((data) => {
        setToken(data.token, rememberMe);
        setLoggedInUser(data.username);
        setRole(data.role);
        setLoginData({ username: "", password: "" });
        setTimeout(() => window.location.reload(), 50);
      })
      .catch(() => alert("❌ Ungültiger Login"));
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setRole(null);
    clearToken();
    setTimeout(() => window.location.reload(), 50);
  };

  const handleScan = async (scannedCode) => {
    const code = String(scannedCode || "").toLowerCase();
    const allowed = ["usr", "tool", "dur", "cancel", "reload", "return"];
    if (!allowed.some((p) => code.startsWith(p))) return;

    if (code === "cancel") {
      cancelDurationSelection();
      return;
    }

    if (code === "reload") {
      window.location.reload();
      return;
    }

    if (code === "return") {
      setReturnMode(true);
      setShowDurationModal(false);
      resetScan("Rückgabemodus aktiviert – bitte Werkzeug scannen");
      return;
    }

    if (code.startsWith("usr")) {
      setReturnMode(false);
      setShowDurationModal(false);
      try {
        const res = await fetch(`${API_URL}/api/users/qr/${code}`);
        if (!res.ok) throw new Error("Benutzer nicht gefunden");
        const foundUser = await res.json();
        setScanState({ user: code, tool: null, duration: null });
        setScannedUser(foundUser);
        setMessage(
          `Benutzer erkannt: ${foundUser.first_name} ${foundUser.last_name}, ${foundUser.qr_code}`
        );
      } catch {
        setMessage(`❌ Benutzer nicht gefunden: ${code}`);
      }
      return;
    }

    if (code.startsWith("tool")) {
      const toolCode = code;

      if (returnMode) {
        const body = JSON.stringify({ tool: toolCode });
        try {
          let res = await fetchWithAuth(
            `${API_URL}/api/reservations/return-tool`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body,
            }
          );

          if (res.status === 404 || res.status === 405) {
            res = await fetchWithAuth(
              `${API_URL}/api/reservations/return-tool`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
              }
            );
          }

          if (!res.ok) {
            res = await fetchWithAuth(
              `${API_URL}/api/reservations/return_tool`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
              }
            );
          }

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Rückgabe fehlgeschlagen");
          }

          setMessage(`✅ Rückgabe abgeschlossen für ${toolCode}`);
          setReturnMode(false);
          setShowDurationModal(false);
          resetScan();
          fetchReservations();
          window.dispatchEvent(
            new CustomEvent("scanventory:reservations:refresh")
          );
        } catch (err) {
          setMessage(`❌ Rückgabe fehlgeschlagen: ${err.message}`);
          setReturnMode(false);
          setShowDurationModal(false);
          resetScan();
        }
        return;
      }

      if (scanState.user) {
        try {
          const res = await fetch(`${API_URL}/api/tools/qr/${toolCode}`);
          if (!res.ok) throw new Error("Werkzeug nicht gefunden");
          const foundTool = await res.json();

          setScanState((prev) => ({ ...prev, tool: toolCode }));
          setScannedTool(foundTool);
          setMessage(
            `Werkzeug erkannt: ${foundTool.name}, ${foundTool.qr_code}`
          );

          setShowDurationModal(true);
        } catch {
          setMessage(`❌ Werkzeug nicht gefunden: ${toolCode}`);
        }
      } else {
        setMessage("Bitte zuerst Benutzer scannen");
      }
      return;
    }

    if (code.startsWith("dur") && scanState.user && scanState.tool) {
      const durationDays = parseInt(code.replace("dur", ""), 10);
      if (!isNaN(durationDays)) {
        const newState = { ...scanState, duration: durationDays };
        setScanState(newState);
        setMessage(`Dauer erkannt: ${durationDays} Tag(e)`);

        try {
          const res = await fetchWithAuth(`${API_URL}/api/reservations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user: newState.user,
              tool: newState.tool,
              duration: newState.duration,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(data.error || "Reservation fehlgeschlagen");

          setShowDurationModal(false);
          resetScan("✅ Reservation gespeichert");
          fetchReservations();
          window.dispatchEvent(
            new CustomEvent("scanventory:reservations:refresh")
          );
        } catch (err) {
          setShowDurationModal(false);
          resetScan(`❌ ${err.message}`);
        }
        return;
      }
    }

    setMessage(`Ungültiger Scan oder falsche Reihenfolge: ${scannedCode}`);
  };

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp > now) {
          setLoggedInUser(decoded.username || "");
          setRole(decoded.role);

          const timeout = decoded.exp * 1000 - Date.now();
          const logoutTimer = setTimeout(() => {
            clearToken();
            setLoggedInUser(null);
            setRole(null);
            alert("⏳ Deine Sitzung ist abgelaufen.");
            window.location.reload();
          }, timeout);

          fetchReservations(); // <-- Token ist gültig → jetzt laden!

          return () => clearTimeout(logoutTimer);
        } else {
          clearToken();
        }
      } catch {
        clearToken();
      }
    } else {
      fetchReservations(); // <-- kein Token (Gast-Zugriff z. B.)
    }
  }, []);

  useEffect(() => {
    const reload = () => fetchReservations();
    window.addEventListener("scanventory:reservations:refresh", reload);
    return () =>
      window.removeEventListener("scanventory:reservations:refresh", reload);
  }, []);

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-title">
          <h1 className="home-title">Scanventory</h1>
        </div>

        {!loggedInUser ? (
          <div className="login-wrapper">
            <div className="login-box">
              <input
                type="text"
                placeholder="Benutzername"
                value={loginData.username}
                onChange={(e) =>
                  setLoginData({ ...loginData, username: e.target.value })
                }
              />
              <input
                type="password"
                placeholder="Passwort"
                value={loginData.password}
                onChange={(e) =>
                  setLoginData({ ...loginData, password: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                Login merken
              </label>
              <button onClick={handleLogin}>Login</button>
            </div>
          </div>
        ) : (
          <div className="login-info">
            <div className="user-label">
              Angemeldet als: <strong>{loggedInUser}</strong>
            </div>
            <div className="login-actions">
              {(role === "admin" || role === "supervisor") && (
                <div className="admin-menu-wrapper">
                  <button className="admin-toggle">
                    <FontAwesomeIcon icon={faCog} />
                  </button>
                  <div className="admin-dropdown">
                    <button onClick={() => (window.location.href = "/tools")}>
                      <FontAwesomeIcon icon={faTools} /> Werkzeuge
                    </button>
                    {role === "admin" && (
                      <>
                        <button
                          onClick={() => (window.location.href = "/users")}
                        >
                          <FontAwesomeIcon icon={faUser} /> Benutzer
                        </button>
                        <button
                          onClick={() =>
                            (window.location.href = "/permissions")
                          }
                        >
                          <FontAwesomeIcon icon={faKey} /> Rechte
                        </button>
                      </>
                    )}
                    {/* HIER angepasst: statt Alert → Navigation */}
                    <button
                      onClick={() =>
                        (window.location.href = "/reservations/manual")
                      }
                    >
                      <FontAwesomeIcon icon={faPlus} /> Reservation
                    </button>
                  </div>
                </div>
              )}
              <button onClick={handleLogout}>
                <FontAwesomeIcon icon={faSignOutAlt} /> Logout
              </button>
            </div>
          </div>
        )}
      </header>

      <section className="home-scanner">
        <div className="home-scanner-head">
          <h2>Scan-Status</h2>
          <h3 className="home-return-title">Rückgabe</h3>
        </div>

        <div className="home-scanner-row">
          <div className="scan-box">{message}</div>
          <div className="home-return">
            <StaticQrCodes />
          </div>
        </div>

        <ScannerHandler onScan={handleScan} />
      </section>

      {role && role !== "guest" && (
        <section className="home-manual-button">
          <button
            className="manual-reservation-button"
            onClick={() => (window.location.href = "/reservations/manual")}
          >
            <FontAwesomeIcon icon={faPlus} /> Manuelle Reservation
          </button>
        </section>
      )}

      <section className="home-calendar">
        <h2>Kalender</h2>
        <CalendarView reservations={reservations} />
      </section>

      <section className="home-scanner-head">
        <h2>Heute reserviert</h2>
      </section>
      <section className="home-today">
        {todayReservations.length === 0 ? (
          <div className="today-empty">Keine heutigen Reservationen.</div>
        ) : (
          <div className="today-table-wrap">
            <table className="today-table">
              <thead>
                <tr>
                  <th>Werkzeug</th>
                  <th>Reserviert von</th>
                  <th>Rückgabe am</th>
                </tr>
              </thead>
              <tbody>
                {todayReservations.map((r) => {
                  const toolLabel =
                    r.tool?.name || r.tool?.qr_code || "Unbekannt";
                  return (
                    <tr key={r.id}>
                      <td className="c-tool" title={toolLabel}>
                        {toolLabel}
                      </td>
                      <td className="c-user">{r._userLabel}</td>
                      <td className="c-until">{formatEnd(r.end)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showDurationModal && (
        <div
          className="duration-overlay"
          onClick={(e) => {
            if (e.target.classList.contains("duration-overlay")) {
              cancelDurationSelection();
            }
          }}
        >
          <div className="duration-modal">
            <h3 className="duration-title"></h3>

            <div className="duration-grid">
              {[1, 2, 3, 4, 5].map((d) => (
                <DurationQrTile key={d} days={d} onPick={pickDuration} />
              ))}
            </div>

            <div className="duration-actions">
              <button onClick={cancelDurationSelection}>
                Reservation abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
