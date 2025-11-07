// frontend/src/pages/ManualReservations.jsx
import { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getToken } from "../utils/authUtils";

import "../styles/ManualReservations.css";

function ManualReservations() {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [tools, setTools] = useState([]);
  const [selectedTools, setSelectedTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hasSetStartDefault, setHasSetStartDefault] = useState(false);
  const [permissions, setPermissions] = useState({});
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$|^\/+/, "");

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
            id: loggedInUser.user_id, // ← HIER!
            username: loggedInUser.username,
            role: loggedInUser.role,
          }
        : { role: "guest" },
    [loggedInUser]
  );

  useEffect(() => {
    if (!currentUser?.id) return;

    fetchWithAuth(`${API_URL}/api/role-permissions/current`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        setPermissions(data);

        if (data.create_reservations === "true") {
          fetchWithAuth(`${API_URL}/api/users`)
            .then((res) => res.json())
            .then((users) => {
              setAvailableUsers(users);
              setSelectedUserId(currentUser.id); // ✅ Hier Standard setzen
            });
        } else {
          setSelectedUserId(currentUser.id); // ✅ Auch für self_only absichern
        }
      })
      .catch(() => {
        setPermissions({});
        setSelectedUserId(currentUser.id); // Fallback
      });
  }, [currentUser]);

  const searchAvailableTools = async () => {
    setTools([]);
    setSelectedTools([]);
    setMessage("");

    if (!start || !end || start >= end) {
      setMessage("Bitte gültigen Zeitraum wählen.");
      return;
    }

    setLoading(true);
    try {
      const qs = `start=${start.toISOString()}&end=${end.toISOString()}`;
      const res = await fetchWithAuth(`${API_URL}/api/tools/available?${qs}`);
      if (!res.ok) throw new Error("Fehler beim Laden verfügbarer Werkzeuge");
      const data = await res.json();
      setTools(data);
      if (data.length === 0)
        setMessage("Keine Werkzeuge im gewählten Zeitraum verfügbar.");
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleToolSelection = (toolId) => {
    setSelectedTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  };

  const reserveSelected = async () => {
    if (!start || !end || selectedTools.length === 0) return;
    setLoading(true);
    try {
      const promises = selectedTools.map((toolId) =>
        fetchWithAuth(`${API_URL}/api/reservations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id:
              permissions.create_reservations === "true"
                ? selectedUserId || currentUser.id
                : currentUser.id,
            tool_id: toolId,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
          }),
        })
      );
      const results = await Promise.all(promises);
      const failed = results.filter((res) => !res.ok);
      if (failed.length > 0)
        throw new Error("Mindestens eine Reservation ist fehlgeschlagen.");
      setMessage("✅ Reservation(en) erfolgreich gespeichert");
      setTools([]);
      setSelectedTools([]);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const groupedUsersByCompany = useMemo(() => {
    const groups = {};
    for (const user of availableUsers) {
      const company = user.company_name || "Andere";
      if (!groups[company]) groups[company] = [];
      groups[company].push(user);
    }

    // Optional: alphabetisch nach Firma und Name sortieren
    const sortedGroups = {};
    Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .forEach((company) => {
        sortedGroups[company] = groups[company].sort((a, b) => {
          const nameA = `${a.first_name || ""} ${
            a.last_name || ""
          }`.toLowerCase();
          const nameB = `${b.first_name || ""} ${
            b.last_name || ""
          }`.toLowerCase();
          return nameA.localeCompare(nameB);
        });
      });

    return sortedGroups;
  }, [availableUsers]);

  return (
    <div className="manualres-container">
      <header className="manualres-header">
        <h1>Manuelle Reservation</h1>
        <div className="manualres-logininfo">
          {loggedInUser ? (
            <div className="manualres-user">
              Angemeldet als: <strong>{loggedInUser.username}</strong>
            </div>
          ) : (
            <div className="manualres-user">
              <strong>Nicht angemeldet</strong>
            </div>
          )}
          <div className="manualres-actions">
            <button onClick={() => (window.location.href = "/")}>
              ← Zurück zur Startseite
            </button>
          </div>
        </div>
      </header>

      <section className="manualres-controls">
        <div className="manualres-row">
          <label>Von:</label>
          <DatePicker
            selected={start}
            onChange={(date) => {
              if (!date) return;

              let newStart = new Date(date);

              if (!hasSetStartDefault) {
                newStart.setHours(6, 0, 0, 0); // Nur beim ersten Mal setzen
                setHasSetStartDefault(true);
              }

              setStart(newStart);

              // Endzeit nur setzen, wenn sie leer oder vor dem Start ist
              if (!end || new Date(end) <= newStart) {
                const newEnd = new Date(newStart);
                newEnd.setHours(23, 45, 0, 0); // Standard-Endzeit
                setEnd(newEnd);
              }
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={30}
            dateFormat="dd.MM.yyyy HH:mm"
            placeholderText="Startdatum & Zeit wählen"
          />

          <label>Bis:</label>
          <DatePicker
            selected={end}
            onChange={(date) => {
              if (!date) return;
              setEnd(date); // Einfach direkt übernehmen
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={30}
            dateFormat="dd.MM.yyyy HH:mm"
            placeholderText="Enddatum & Zeit wählen"
          />

          {permissions.create_reservations === "true" && (
            <div className="manualres-row">
              <label>Für Benutzer:</label>
              <select
                value={selectedUserId || ""}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">-- Benutzer auswählen --</option>
                {Object.entries(groupedUsersByCompany).map(
                  ([company, users]) => (
                    <optgroup key={company} label={company}>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.first_name || ""} {user.last_name || ""} (
                          {company})
                        </option>
                      ))}
                    </optgroup>
                  )
                )}
              </select>
            </div>
          )}

          <button
            className="manualres-button"
            onClick={searchAvailableTools}
            disabled={loading}
          >
            Werkzeuge suchen
          </button>
        </div>

        {message && <div className="manualres-message">{message}</div>}
      </section>

      <section className="manualres-tablewrap">
        <table className="manualres-table">
          <thead>
            <tr>
              <th>Auswahl</th>
              <th>Name</th>
              <th>QR-Code</th>
              <th>Kategorie</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <tr key={tool.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedTools.includes(tool.id)}
                    onChange={() => toggleToolSelection(tool.id)}
                  />
                </td>
                <td>{tool.name}</td>
                <td>{tool.qr_code}</td>
                <td>{tool.category_name || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {tools.length > 0 && (
          <div className="manualres-reserve-button">
            <button
              onClick={reserveSelected}
              disabled={loading || selectedTools.length === 0}
            >
              Ausgewählte reservieren
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default ManualReservations;
