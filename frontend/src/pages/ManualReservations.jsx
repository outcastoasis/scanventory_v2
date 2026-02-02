// frontend/src/pages/ManualReservations.jsx
import { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getToken } from "../utils/authUtils";
import { useLocation, useNavigate } from "react-router-dom";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquareCheck } from "@fortawesome/free-solid-svg-icons";

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
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("return"); // z.B. "/mobile/today"
  }, [location.search]);

  const handleBack = () => {
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    navigate("/"); // Fallback: Startseite
  };

  // ✅ Suche + Sortierung
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "qr_code", // ✅ Standardspalte
    direction: "asc",
  });

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
            id: loggedInUser.user_id,
            username: loggedInUser.username,
            role: loggedInUser.role,
          }
        : { role: "guest" },
    [loggedInUser],
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
              setSelectedUserId(currentUser.id);
            });
        } else {
          setSelectedUserId(currentUser.id);
        }
      })
      .catch(() => {
        setPermissions({});
        setSelectedUserId(currentUser.id);
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
        : [...prev, toolId],
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
        }),
      );

      const results = await Promise.all(promises);
      const failed = results.filter((res) => !res.ok);
      if (failed.length > 0)
        throw new Error("Mindestens eine Reservation ist fehlgeschlagen.");

      setMessage(
        <>
          <FontAwesomeIcon
            icon={faSquareCheck}
            style={{ marginRight: "6px" }}
          />
          Reservation(en) erfolgreich gespeichert
        </>,
      );
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

    const sortedGroups = {};
    Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .forEach((company) => {
        sortedGroups[company] = groups[company].sort((a, b) => {
          const nameA =
            `${a.first_name || ""} ${a.last_name || ""}`.toLowerCase();
          const nameB =
            `${b.first_name || ""} ${b.last_name || ""}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });
      });

    return sortedGroups;
  }, [availableUsers]);

  // ✅ Sort-Handler wie AdminTools
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc")
      direction = "desc";
    setSortConfig({ key, direction });
  };

  // ✅ Filter + Sort (wird in der Tabelle gerendert)
  const filteredTools = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return tools;

    return tools.filter((t) => {
      return (
        t.id?.toString().includes(term) ||
        t.name?.toLowerCase().includes(term) ||
        t.qr_code?.toLowerCase().includes(term) ||
        t.category_name?.toLowerCase().includes(term)
      );
    });
  }, [tools, searchTerm]);

  const sortedTools = useMemo(() => {
    const list = [...filteredTools];
    const { key, direction } = sortConfig;
    if (!key) return list;

    const dir = direction === "asc" ? 1 : -1;

    return list.sort((a, b) => {
      if (key === "id") {
        const ai = Number(a.id) || 0;
        const bi = Number(b.id) || 0;
        return (ai - bi) * dir;
      }

      const A = a[key]?.toString().toLowerCase() ?? "";
      const B = b[key]?.toString().toLowerCase() ?? "";
      if (A < B) return -1 * dir;
      if (A > B) return 1 * dir;
      return 0;
    });
  }, [filteredTools, sortConfig]);

  // ✅ kleines Helper-Rendering fuer Sort-Icon (wie AdminTools)
  const SortIcon = ({ colKey }) => (
    <span className="sort-icon">
      {sortConfig.key === colKey
        ? sortConfig.direction === "asc"
          ? "▼"
          : "▲"
        : "▼"}
    </span>
  );

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
            <button onClick={handleBack}>
              ← {returnTo ? "Zurück" : "Zurück zur Startseite"}
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
                newStart.setHours(6, 0, 0, 0);
                setHasSetStartDefault(true);
              }

              setStart(newStart);

              if (!end || new Date(end) <= newStart) {
                const newEnd = new Date(newStart);
                newEnd.setHours(23, 45, 0, 0);
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
              setEnd(date);
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
                  ),
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
        {/* ✅ Suchfeld nur anzeigen, wenn es Tools gibt (optional) */}
        {tools.length > 0 && (
          <div className="manualres-tabletools">
            <input
              className="manualres-search"
              type="text"
              placeholder="Suche (Name, QR-Code, Kategorie...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        <table className="manualres-table">
          <thead>
            <tr>
              <th>Auswahl</th>

              <th
                onClick={() => handleSort("name")}
                className={sortConfig.key === "name" ? "sorted" : ""}
              >
                Name <SortIcon colKey="name" />
              </th>

              <th
                onClick={() => handleSort("qr_code")}
                className={sortConfig.key === "qr_code" ? "sorted" : ""}
              >
                QR-Code <SortIcon colKey="qr_code" />
              </th>

              <th
                onClick={() => handleSort("category_name")}
                className={sortConfig.key === "category_name" ? "sorted" : ""}
              >
                Kategorie <SortIcon colKey="category_name" />
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedTools.map((tool) => (
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
