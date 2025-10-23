import { useState, useEffect, useMemo, useRef } from "react"; // useRef ergänzen
import { faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
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
  faWrench,
} from "@fortawesome/free-solid-svg-icons";

function Home() {
  const boxRef = useRef(null);
  const [flashType, setFlashType] = useState(null); // "success" | "error" | null
  const flashTimerRef = useRef(null);

  const triggerFlash = (type, ms = 3000) => {
    // Timer stoppen
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // Klasse entfernen, Reflow erzwingen, dann neu setzen
    setFlashType(null);
    requestAnimationFrame(() => {
      // Reflow
      void boxRef.current?.offsetWidth;
      // Klasse wieder setzen
      setFlashType(type);
    });
  };
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

  const [flashOK, setFlashOK] = useState(false);

  const returnTimerRef = useRef(null);
  const [returnCountdown, setReturnCountdown] = useState(null);
  const returnCountdownIntervalRef = useRef(null);

  // Grünes aufleuchten bei erfolgreichen Scan
  useEffect(() => {
    if (scanState.user && scanState.tool) {
      setFlashOK(true);
      const t = setTimeout(() => setFlashOK(false), 1000);
      return () => clearTimeout(t);
    }
  }, [scanState.user, scanState.tool]);

  // Für Heute Reserviert Ansicht
  const activeReservations = useMemo(() => {
    const now = new Date();

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

    return (reservations || [])
      .filter((r) => {
        const start = toLocalDate(r.start);
        const end = toLocalDate(r.end);
        return start <= now && end >= now; // Nur aktuell laufende
      })
      .sort((a, b) => toLocalDate(a.end) - toLocalDate(b.end))
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

    useEffect(() => {
      const canvas = document.getElementById("cancel-qr");
      if (!canvas) return;
      QRCode.toCanvas(canvas, "cancel", { width: 140, margin: 1 }).catch(
        () => {}
      );
    }, []);

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
    triggerFlash("error");
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
  triggerFlash("success");
  resetScan("Rückgabemodus aktiviert – bitte Werkzeug scannen");

  if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
  if (returnCountdownIntervalRef.current) {
    clearInterval(returnCountdownIntervalRef.current);
    returnCountdownIntervalRef.current = null;
  }

  setReturnCountdown(15);

  let count = 15;
  const countdownInterval = setInterval(() => {
    count -= 1;
    if (count <= 0) {
      clearInterval(countdownInterval);
      returnCountdownIntervalRef.current = null;
      setReturnCountdown(null);
      return;
    }
    setReturnCountdown(count);
  }, 1000);

  returnCountdownIntervalRef.current = countdownInterval;

  returnTimerRef.current = setTimeout(() => {
    clearInterval(countdownInterval);
    returnCountdownIntervalRef.current = null;
    setReturnCountdown(null);
    setReturnMode(false); // ✅ hier ist korrekt
    setShowDurationModal(false);
    setMessage("Rückgabemodus abgelaufen – bitte Benutzer scannen");
    triggerFlash("error");
    resetScan();
  }, 15000);

  return;
}

    if (code.startsWith("usr")) {
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
      if (returnCountdownIntervalRef.current) {
        clearInterval(returnCountdownIntervalRef.current);
        returnCountdownIntervalRef.current = null;
      }
      setReturnCountdown(null);
      setReturnMode(false);
      try {
        const res = await fetch(`${API_URL}/api/users/qr/${code}`);
        if (!res.ok) throw new Error("Benutzer nicht gefunden");
        const foundUser = await res.json();
        setScanState({ user: code, tool: null, duration: null });
        setScannedUser(foundUser);
        triggerFlash("success");
        setMessage(
          `Benutzer erkannt: ${foundUser.first_name} ${foundUser.last_name}, ${foundUser.qr_code}`
        );
      } catch {
        setMessage(`❌ Benutzer nicht gefunden: ${code}`);
        triggerFlash("error");
      }
      return;
    }

    if (code.startsWith("tool")) {
      const toolCode = code;
      setReturnCountdown(null);

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
              `${API_URL}/api/reservations/return-tool`,
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
          triggerFlash("success");
          setReturnMode(false);
          if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
          if (returnCountdownIntervalRef.current) {
            clearInterval(returnCountdownIntervalRef.current);
            returnCountdownIntervalRef.current = null;
          }
          setReturnCountdown(null);
          setReturnMode(false);
          setReturnCountdown(null);
          setShowDurationModal(false);
          resetScan();
          fetchReservations();
          window.dispatchEvent(
            new CustomEvent("scanventory:reservations:refresh")
          );
        } catch (err) {
          setMessage(`❌ Rückgabe fehlgeschlagen: ${err.message}`);
          triggerFlash("error");
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
          triggerFlash("success");
          setMessage(
            `Werkzeug erkannt: ${foundTool.name}, ${foundTool.qr_code}`
          );

          setShowDurationModal(true);
        } catch {
          setMessage(`❌ Werkzeug nicht gefunden: ${toolCode}`);
          triggerFlash("error");
        }
      } else {
        try {
          const res = await fetch(`${API_URL}/api/tools/info/${toolCode}`);
          if (!res.ok) throw new Error("Werkzeug nicht gefunden");
          const data = await res.json();

          const tool = data.tool;
          const active = data.active_reservation;
          const upcoming = data.upcoming_reservations || [];

          // 🧩 Hilfsfunktion zum Formatieren der Datumsangaben
          const formatDateRange = (start, end) => {
            const toDateParts = (s) => {
              const d = new Date(s.replace(" ", "T"));
              const dd = String(d.getDate()).padStart(2, "0");
              const mm = String(d.getMonth() + 1).padStart(2, "0");
              const yyyy = d.getFullYear();
              const hh = String(d.getHours()).padStart(2, "0");
              const min = String(d.getMinutes()).padStart(2, "0");
              return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
            };
            return `${toDateParts(start)} - ${toDateParts(end)}`;
          };

          // Anzeige-Text aufbauen
          let msg = `Werkzeug: ${tool.name}\nQR-Code: ${
            tool.qr_code
          }\nStatus: ${tool.is_borrowed ? "Reserviert" : "Frei"}`;

          if (active) {
            msg += `\n\nAktuell reserviert von ${active.user.first_name} ${
              active.user.last_name
            }\n${formatDateRange(active.start, active.end)}`;
          }

          if (upcoming.length > 0) {
            msg += `\n\nNächste Reservationen:`;
            upcoming.forEach((r, i) => {
              msg += `\n${i + 1}. ${r.user.first_name} ${
                r.user.last_name
              }: ${formatDateRange(r.start, r.end)}`;
            });
          }

          setMessage(msg);
          triggerFlash("success");

          // Nach 20 Sekunden wieder zurücksetzen
          setTimeout(() => {
            setMessage("Bitte zuerst Benutzer scannen");
          }, 20000);
        } catch (err) {
          setMessage(`❌ Werkzeug nicht gefunden: ${toolCode}`);
          triggerFlash("error");
        }
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

          const data = await res.json();

          if (!res.ok) {
            console.error("Reservation Error:", data); // ❗ Nur im Fehlerfall
            throw new Error(data.error || "Reservation fehlgeschlagen");
          }

          triggerFlash("success");
          setShowDurationModal(false);
          resetScan("✅ Reservation gespeichert");
          fetchReservations();
          window.dispatchEvent(
            new CustomEvent("scanventory:reservations:refresh")
          );
        } catch (err) {
          setShowDurationModal(false);
          resetScan(`❌ ${err.message}`);
          triggerFlash("error");
        }

        return;
      }
    }

    setMessage(`Ungültiger Scan oder falsche Reihenfolge: ${scannedCode}`);
    triggerFlash("error");
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

          fetchReservations(); // Initial

          const interval = setInterval(() => {
            fetchReservations();
          }, 30000); // ⏱ Polling

          return () => {
            clearTimeout(logoutTimer);
            clearInterval(interval);
          };
        } else {
          clearToken();
        }
      } catch {
        clearToken();
      }
    } else {
      fetchReservations(); // Für Gäste
      const interval = setInterval(() => {
        fetchReservations();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    const reload = () => fetchReservations();
    window.addEventListener("scanventory:reservations:refresh", reload);
    return () =>
      window.removeEventListener("scanventory:reservations:refresh", reload);
  }, []);

  useEffect(() => {
    return () => {
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
      if (returnCountdownIntervalRef.current) {
        clearInterval(returnCountdownIntervalRef.current);
        returnCountdownIntervalRef.current = null;
      }
      setReturnCountdown(null);
      setReturnMode(false);
    };
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
            <button
              className="admin-toggle help-nav-button"
              onClick={() => (window.location.href = "/help")}
              title="Hilfe / Anleitung"
              aria-label="Hilfe / Anleitung"
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
            </button>
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
                        <button
                          onClick={() =>
                            (window.location.href = "/admin-panel")
                          }
                        >
                          <FontAwesomeIcon icon={faWrench} /> Admin-Panel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <button onClick={handleLogout}>
                <FontAwesomeIcon icon={faSignOutAlt} /> Logout
              </button>

              <button
                className="admin-toggle help-nav-button"
                onClick={() => (window.location.href = "/help")}
                title="Hilfe / Anleitung"
                aria-label="Hilfe / Anleitung"
              >
                <FontAwesomeIcon icon={faQuestionCircle} />
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
          <div
            ref={boxRef}
            className={`scan-box ${
              flashType === "success" ? "flash-success" : ""
            } ${flashType === "error" ? "flash-error" : ""}`}
          >
            {message}
            {returnCountdown !== null && (
              <div className="return-countdown">{returnCountdown}s</div>
            )}
          </div>

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
        <h2>Aktuell reserviert</h2>
      </section>
      <section className="home-today">
        {activeReservations.length === 0 ? (
          <div className="today-empty">Keine aktuellen Reservationen.</div>
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
                {activeReservations.map((r) => {
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

              <button
                className="duration-tile"
                onClick={cancelDurationSelection}
                aria-label="Vorgang abbrechen"
                title="Abbrechen (cancel)"
              >
                <canvas
                  id="cancel-qr"
                  style={{ width: "140px", height: "140px" }}
                />
                <span className="duration-tile-label">Abbrechen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
