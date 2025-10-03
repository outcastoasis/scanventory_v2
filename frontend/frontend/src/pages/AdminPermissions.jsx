// frontend/src/pages/AdminPermissions.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/AdminPermissions.css";
import PermissionForm from "../components/PermissionForm";
import QrModal from "../components/QrModal";

const API_URL = import.meta.env.VITE_API_URL;
const getToken = () => localStorage.getItem("token");

export default function AdminPermissions() {
  const navigate = useNavigate();

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("key");
  const [sortDir, setSortDir] = useState("asc");

  const [showForm, setShowForm] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [qrPermission, setQrPermission] = useState(null);

  // Access check
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error("Nicht autorisiert");
        const data = await res.json();
        if (data.permissions?.access_admin_panel !== "true") {
          navigate("/");
        }
      } catch {
        navigate("/");
      }
    })();
  }, []);

  // load data
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [rRoles, rPerms, rMap] = await Promise.all([
          fetch(`${API_URL}/api/roles`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
          fetch(`${API_URL}/api/permissions`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
          fetch(`${API_URL}/api/role-permissions`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
        ]);
        if (!rRoles.ok || !rPerms.ok || !rMap.ok) throw new Error();

        const [rolesData, permsData, mapData] = await Promise.all([
          rRoles.json(),
          rPerms.json(),
          rMap.json(),
        ]);
        setRoles(rolesData);
        setPermissions(permsData);

        // Matrix bauen: default "false", dann vorhandene Mappings überschreiben
        const m = {};
        for (const p of permsData) {
          m[p.key] = {};
          for (const r of rolesData) m[p.key][r.name] = "false";
        }
        for (const it of mapData) {
          if (m[it.permission] && m[it.permission][it.role] !== undefined) {
            m[it.permission][it.role] = it.value;
          }
        }
        setMatrix(m);
        setError("");
      } catch (e) {
        console.error(e);
        setError("Fehler beim Laden der Daten.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = !term
      ? permissions
      : permissions.filter((p) => p.key.toLowerCase().includes(term));
    return [...list].sort((a, b) => {
      const A = (a[sortKey] ?? "").toString().toLowerCase();
      const B = (b[sortKey] ?? "").toString().toLowerCase();
      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [permissions, searchTerm, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const updateCell = async (roleName, permKey, value) => {
    setMatrix((prev) => ({
      ...prev,
      [permKey]: { ...(prev[permKey] || {}), [roleName]: value },
    }));
    try {
      const res = await fetch(`${API_URL}/api/role-permissions`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ role: roleName, permission: permKey, value }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error ||
            "Speichern fehlgeschlagen"
        );
    } catch (e) {
      alert(e.message);
    }
  };

  const removePermission = async (perm) => {
    if (!confirm(`Recht "${perm.key}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/permissions/${perm.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Löschen fehlgeschlagen.");
      setPermissions((prev) => prev.filter((p) => p.id !== perm.id));
      setMatrix((prev) => {
        const c = { ...prev };
        delete c[perm.key];
        return c;
      });
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="permissions-page">
      <div className="permissions-header">
        <h2 className="permissions-title">Rechteverwaltung</h2>
        <button
          className="permissions-back-button"
          onClick={() => navigate("/")}
        >
          ← Zurück zur Startseite
        </button>
      </div>

      {error && <p className="permissions-error">{error}</p>}
      {loading ? (
        <p className="permissions-loading">Lade Rechte...</p>
      ) : (
        <>
          <div className="permissions-actions">
            <button
              className="permissions-add-button"
              onClick={() => {
                setEditingPermission(null);
                setShowForm(true);
              }}
            >
              + Neues Recht
            </button>
            <input
              className="permissions-search"
              type="text"
              placeholder="Suche nach Recht (key)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <table className="permissions-table">
            <thead>
              <tr>
                <th
                  onClick={() => toggleSort("key")}
                  className={sortKey === "key" ? "sorted" : ""}
                  style={{ minWidth: 180 }}
                >
                  Permission-Key{" "}
                  <span className="sort-icon">
                    {sortKey === "key" ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
                  </span>
                </th>
                {roles.map((r) => (
                  <th key={r.id} style={{ minWidth: 150 }}>
                    {r.name}
                  </th>
                ))}
                <th style={{ minWidth: 200 }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((perm) => (
                <tr key={perm.id}>
                  <td>{perm.key}</td>
                  {roles.map((r) => {
                    const val = matrix[perm.key]?.[r.name] ?? "false";
                    return (
                      <td key={r.id}>
                        <select
                          className="permissions-cell-select"
                          value={val}
                          onChange={(e) =>
                            updateCell(r.name, perm.key, e.target.value)
                          }
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                          <option value="self_only">self_only</option>
                        </select>
                      </td>
                    );
                  })}
                  <td className="permissions-actions-cell">
                    <button
                      className="permissions-edit-button"
                      onClick={() => {
                        setEditingPermission(perm);
                        setShowForm(true);
                      }}
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="permissions-delete-button"
                      onClick={() => removePermission(perm)}
                    >
                      Löschen
                    </button>
                    <button
                      className="permissions-qr-button"
                      onClick={() => setQrPermission(perm)}
                    >
                      QR anzeigen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {qrPermission && (
            <QrModal
              permission={qrPermission}
              onClose={() => setQrPermission(null)}
            />
          )}
        </>
      )}

      {showForm && (
        <div
          className="permissions-modal-overlay"
          onClick={() => setShowForm(false)}
        >
          <div
            className="permissions-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <PermissionForm
              permission={editingPermission}
              onClose={() => setShowForm(false)}
              onSave={(saved) => {
                setShowForm(false);
                setPermissions((prev) => {
                  const idx = prev.findIndex((p) => p.id === saved.id);
                  if (idx === -1) return [...prev, saved];
                  const c = [...prev];
                  c[idx] = saved;
                  return c;
                });
                if (editingPermission && editingPermission.key !== saved.key) {
                  setMatrix((prev) => {
                    const c = { ...prev };
                    c[saved.key] = prev[editingPermission.key] || {};
                    delete c[editingPermission.key];
                    return c;
                  });
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
