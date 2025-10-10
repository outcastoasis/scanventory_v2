import { useState, useEffect } from "react";
import ScannerHandler from "../components/ScannerHandler";
import "../styles/Home.css";
import CalendarView from "../components/CalendarView";
import { jwtDecode } from "jwt-decode";
import StaticQrCodes from "../components/StaticQrCodes";

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
  const [scannedUser, setScannedUser] = useState(null);
  const [scannedTool, setScannedTool] = useState(null);

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

  const fetchWithAuth = (url, options = {}) => {
    const token = localStorage.getItem("token");
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  const handleScan = async (scannedCode) => {
    const code = String(scannedCode || "").toLowerCase();
    const allowedPrefixes = [
      "usr",
      "tool",
      "dur",
      "cancel",
      "reload",
      "return",
    ];
    if (!allowedPrefixes.some((p) => code.startsWith(p))) return;

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
      try {
        const res = await fetch(`${API_URL}/api/users/qr/${code}`);
        if (!res.ok) throw new Error("Benutzer nicht gefunden");
        const foundUser = await res.json();
        setScanState({ user: code, tool: null, duration: null });
        setScannedUser(foundUser);
        setMessage(
          `Benutzer erkannt: ${foundUser.first_name} ${foundUser.last_name}, ${foundUser.qr_code}`
        );
      } catch (err) {
        console.error(err);
        setMessage(`❌ Benutzer nicht gefunden: ${code}`);
      }
      return;
    }

    if (code.startsWith("tool")) {
      const toolCode = code;

      // ---- Rückgabe (robust) ----
      if (returnMode) {
        const body = JSON.stringify({ tool: toolCode });
        try {
          // 1) PATCH /return-tool
          let res = await fetchWithAuth(
            `${API_URL}/api/reservations/return-tool`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body,
            }
          );

          // 2) Fallback: POST /return-tool
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

          // 3) Fallback: Alias /return_tool
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
          resetScan();
          fetchReservations();
          window.dispatchEvent(
            new CustomEvent("scanventory:reservations:refresh")
          );
        } catch (err) {
          setMessage(`❌ Rückgabe fehlgeschlagen: ${err.message}`);
          setReturnMode(false);
          resetScan();
        }
        return;
      }

      // ---- normale Ausleihe (Werkzeug scannen) ----
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
        } catch (err) {
          console.error(err);
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

          resetScan("✅ Reservation gespeichert");
          fetchReservations();
          window.dispatchEvent(
            new CustomEvent("scanventory:reservations:refresh")
          );
        } catch (err) {
          console.error("Fehler beim Speichern:", err);
          resetScan(`❌ ${err.message}`);
        }
        return;
      }
    }

    setMessage(`Ungültiger Scan oder falsche Reihenfolge: ${scannedCode}`);
  };

  const resetScan = (msg = "") => {
    setScanState({ user: null, tool: null, duration: null });
    setScannedUser(null);
    setScannedTool(null);
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

  // Initial-Load + Polling
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

    fetchReservations(); // Initial laden

    const interval = setInterval(() => fetchReservations(), 30000);
    return () => clearInterval(interval);
  }, []);

  // 🔁 Auf Refresh-Event hören (von CalendarView nach Speichern/Rückgabe)
  useEffect(() => {
    const reload = () => fetchReservations();
    window.addEventListener("scanventory:reservations:refresh", reload);
    return () =>
      window.removeEventListener("scanventory:reservations:refresh", reload);
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
                            (window.location.href = "/permissions")
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
        <div className="home-scanner-row">
          <div className="scan-box">{message}</div>
          <StaticQrCodes />
        </div>
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
