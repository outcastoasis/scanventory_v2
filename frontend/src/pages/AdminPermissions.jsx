// frontend/src/pages/AdminPermissions.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/AdminPermissions.css";
import PermissionForm from "../components/PermissionForm";
import { getToken } from "../utils/authUtils";
import AdminDropdown from "../components/AdminDropdown";

const API_URL = import.meta.env.VITE_API_URL;

export default function AdminPermissions() {
  const navigate = useNavigate();

  // Zugriff prüfen – analog AdminPanel
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const res = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });

        const data = await res.json();

        if (data.permissions?.access_admin_panel !== "true") {
          navigate("/");
        } else {
          setUserPermissions(data.permissions || {});
        }
      } catch (err) {
        navigate("/");
      }
    };

    checkAccess();
  }, []);

  const [roles, setRoles] = useState([]); // [{id,name}]
  const [permissions, setPermissions] = useState([]); // [{id,key}]
  const [matrix, setMatrix] = useState({}); // { permKey: { roleName: "true|false|self_only" } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("id"); // "id" | "key"
  const [sortDir, setSortDir] = useState("asc");

  const [showForm, setShowForm] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});

  // Daten laden
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // 1) Permissions
        const pRes = await fetch(`${API_URL}/api/permissions`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (pRes.status === 401 || pRes.status === 403) {
          setError(
            "Kein Zugriff auf die Rechteverwaltung. Bitte als Admin/Supervisor anmelden und sicherstellen, dass das Recht 'access_admin_panel' existiert."
          );
          setLoading(false);
          return;
        }
        if (!pRes.ok) throw new Error("Permissions-Load fehlgeschlagen");
        const permsData = await pRes.json();
        setPermissions(permsData);

        // 2) Matrix
        const mRes = await fetch(`${API_URL}/api/role-permissions`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!mRes.ok) throw new Error("Matrix-Load fehlgeschlagen");
        const rows = await mRes.json(); // [{role, permissions:{key:value}}]

        const roleNames = Array.from(new Set(rows.map((r) => r.role)));
        setRoles(roleNames.map((n) => ({ id: n, name: n })));

        const m = {};
        for (const p of permsData) {
          m[p.key] = {};
          for (const rn of roleNames) m[p.key][rn] = "false";
        }
        for (const row of rows) {
          for (const [k, v] of Object.entries(row.permissions || {})) {
            if (!m[k]) m[k] = {};
            m[k][row.role] = v;
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
      if (sortKey === "id") {
        const A = Number(a.id) || 0;
        const B = Number(b.id) || 0;
        return sortDir === "asc" ? A - B : B - A;
      }
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
    const prev = matrix[permKey]?.[roleName];
    setMatrix((old) => ({
      ...old,
      [permKey]: { ...(old[permKey] || {}), [roleName]: value },
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
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.error || "Speichern fehlgeschlagen");
      }
    } catch (e) {
      alert(e.message);
      // Rollback
      setMatrix((old) => ({
        ...old,
        [permKey]: { ...(old[permKey] || {}), [roleName]: prev },
      }));
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
        <div className="permissions-header-actions">
          <AdminDropdown permissions={userPermissions} />
          <button
            className="permissions-back-button"
            onClick={() => navigate("/")}
          >
            ← Zurück zur Startseite
          </button>
        </div>
      </div>

      {error && <p className="permissions-error">{error}</p>}
      {loading ? (
        <p className="permissions-loading">Lade Rechte...</p>
      ) : (
        <>
          <div className="permissions-actions">
            {/* 
            auskommentiert da das hinzufügen von neuen Rechten momentan noch nicht relevant ist
            <button
              className="permissions-add-button"
              onClick={() => {
                setEditingPermission(null);
                setShowForm(true);
              }}
            >
              + Neues Recht
            </button>
            */}

            <input
              className="permissions-search"
              type="text"
              placeholder="Suche nach Recht (key)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="permissions-mobile-search">
            <input
              className="permissions-search"
              type="text"
              placeholder="Suche nach Recht..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* ---------- Mobile Kartenansicht ---------- */}
          <div className="permissions-list-mobile">
            {filtered.map((perm) => (
              <div className="permission-card" key={perm.id}>
                <div className="permission-card-header">
                  <h3>{perm.key}</h3>
                  <span>ID {perm.id}</span>
                </div>
                <div className="permission-card-body">
                  {roles.map((r) => (
                    <p key={r.id}>
                      <strong>{r.name}: </strong>
                      <select
                        value={matrix[perm.key]?.[r.name] ?? "false"}
                        onChange={(e) =>
                          updateCell(r.name, perm.key, e.target.value)
                        }
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                        <option value="self_only">self_only</option>
                      </select>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <table className="permissions-table">
            <thead>
              <tr>
                <th
                  onClick={() => toggleSort("id")}
                  className={sortKey === "id" ? "sorted" : ""}
                  style={{ minWidth: 80 }}
                >
                  ID{" "}
                  <span className="sort-icon">
                    {sortKey === "id" ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
                  </span>
                </th>

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
                {/*
                <th style={{ minWidth: 200 }}>Aktionen</th>
                */}
              </tr>
            </thead>

            <tbody>
              {filtered.map((perm) => (
                <tr key={perm.id}>
                  <td>{perm.id}</td>
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

                  {/* 
                  <td className="permissions-actions-cell">
                    <button
                      className="permissions-delete-button"
                      onClick={() => removePermission(perm)}
                    >
                      Löschen
                    </button>
                  </td>
*/}
                </tr>
              ))}
            </tbody>
          </table>
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
