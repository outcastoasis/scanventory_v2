import { useState, useEffect } from "react";
import ScannerHandler from "../components/ScannerHandler";
import "../styles/Home.css";
import CalendarView from "../components/CalendarView";
import { jwtDecode } from "jwt-decode";

// Font Awesome Imports
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

  const API_URL = import.meta.env.VITE_API_URL;

  const fetchWithAuth = (url, options = {}) => {
    const token = localStorage.getItem("token");
    if (!token) {
      return fetch(url, options);
    }
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  };

  const handleScan = (scannedCode) => {
    const code = scannedCode.toLowerCase();
    const allowedPrefixes = [
      "usr",
      "tool",
      "dur",
      "cancel",
      "reload",
      "return",
    ];
    const isValidPrefix = allowedPrefixes.some((prefix) =>
      code.startsWith(prefix)
    );
    if (!isValidPrefix) return;

    if (code === "cancel") {
      setReturnMode(false);
      resetScan("Vorgang abgebrochen.");
      return;
    }

    if (code === "reload") {
      window.location.reload();
      return;
    }

    if (code === "return") {
      setReturnMode(true);
      resetScan("Rückgabemodus aktiviert – bitte Werkzeug scannen");
      return;
    }

    if (code.startsWith("usr")) {
      setReturnMode(false);
      setScanState({ user: code, tool: null, duration: null });
      setMessage(`Benutzer erkannt: ${code}`);
      return;
    }

    if (code.startsWith("tool")) {
      const toolCode = code;
      if (returnMode) {
        fetchWithAuth(`${API_URL}/api/reservations/return-tool`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: toolCode }),
        })
          .then((res) => {
            if (res.status === 200) return res.json();
            throw new Error("Keine aktive Ausleihe gefunden");
          })
          .then(() => {
            setMessage(`✅ Rückgabe abgeschlossen für ${toolCode}`);
            setReturnMode(false);
            resetScan();
            fetchReservations();
          })
          .catch((err) => {
            setMessage(`❌ Rückgabe fehlgeschlagen: ${err.message}`);
            setReturnMode(false);
            resetScan();
          });
        return;
      }

      if (scanState.user) {
        setScanState((prev) => ({ ...prev, tool: toolCode }));
        setMessage(`Werkzeug erkannt: ${toolCode}`);
      } else {
        setMessage("Bitte zuerst Benutzer scannen");
      }
      return;
    }

    if (code.startsWith("dur") && scanState.user && scanState.tool) {
      const durationDays = parseInt(code.replace("dur", ""));
      if (!isNaN(durationDays)) {
        const newState = { ...scanState, duration: durationDays };
        setScanState(newState);
        setMessage(`Dauer erkannt: ${durationDays} Tag(e)`);

        fetchWithAuth(`${API_URL}/api/reservations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: newState.user,
            tool: newState.tool,
            duration: newState.duration,
          }),
        })
          .then((res) => res.json())
          .then(() => {
            resetScan("Reservation gespeichert ✅");
            fetchReservations();
          })
          .catch((err) => {
            console.error("Fehler beim Speichern:", err);
            resetScan("Fehler bei der Reservation ❌");
          });
        return;
      }
    }

    setMessage(`Ungültiger Scan oder falsche Reihenfolge: ${scannedCode}`);
  };

  const resetScan = (msg = "") => {
    setScanState({ user: null, tool: null, duration: null });
    if (msg) setMessage(msg);
  };

  const fetchReservations = () => {
    fetchWithAuth(`${API_URL}/api/reservations`)
      .then((res) => res.json())
      .then((data) => setReservations(data))
      .catch((err) =>
        console.error("Fehler beim Laden der Reservationen:", err)
      );
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
        setLoggedInUser(data.username);
        setRole(data.role);
        localStorage.setItem("token", data.token);
        setLoginData({ username: "", password: "" });
        fetchReservations();
      })
      .catch(() => alert("❌ Ungültiger Login"));
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setRole(null);
    localStorage.removeItem("token");
    fetchReservations();
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setLoggedInUser(decoded.username || "");
        setRole(decoded.role);
      } catch (err) {
        console.error("Ungültiger Token:", err);
        localStorage.removeItem("token");
      }
    }
    fetchReservations();
  }, []);

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>Scanventory</h1>

        {!loggedInUser ? (
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
            />
            <button onClick={handleLogin}>Login</button>
          </div>
        ) : (
          <div className="login-info">
            <div className="user-label">
              Angemeldet als: <strong>{loggedInUser}</strong> ({role})
            </div>
            <div className="login-actions">
              {/* Admin Dropdown */}
              {loggedInUser && (role === "admin" || role === "supervisor") && (
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
                            (window.location.href = "/admin-tools")
                          }
                        >
                          <FontAwesomeIcon icon={faKey} /> Rechte
                        </button>
                      </>
                    )}
                    <button onClick={() => alert("Manuelle Reservation folgt")}>
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
        <h2>Scan-Status</h2>
        <div className="scan-box">{message}</div>
        <ScannerHandler onScan={handleScan} />
      </section>

      <section className="home-calendar">
        <h2>Kalender</h2>
        <CalendarView reservations={reservations} />
      </section>
    </div>
  );
}

export default Home;
