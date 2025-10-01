// frontend/src/pages/AdminUsers.jsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import UserForm from "../components/UserForm";
import "../styles/AdminUsers.css";
const API_URL = import.meta.env.VITE_API_URL;

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentUserId, setCurrentUserId] = useState(null);

  const getToken = () => localStorage.getItem("token");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/me`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        if (!res.ok) throw new Error("Nicht autorisiert");

        const data = await res.json();

        if (data.permissions?.manage_users !== "true") {
          navigate("/");
        } else {
          setCurrentUserId(data.user_id);
        }
      } catch (err) {
        navigate("/");
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId === null) return; // Warte, bis ID geladen

    fetch(`${API_URL}/api/users`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Fehler beim Abrufen der Benutzer");
        return res.json();
      })
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Fehler beim Laden der Benutzer.");
        setLoading(false);
      });
  }, [currentUserId]);

  const handleDelete = (id) => {
    if (!currentUserId) {
      alert("Benutzerdaten noch nicht geladen.");
      return;
    }

    if (confirm("Benutzer wirklich löschen?")) {
      fetch(`${API_URL}/api/users/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Fehler beim Löschen.");
          }
          setUsers(users.filter((u) => u.id !== id));
        })
        .catch((err) => {
          alert(err.message);
        });
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.id.toString().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      u.qr_code.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term) ||
      (u.created_at && u.created_at.toLowerCase().includes(term))
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const valA = a[sortConfig.key]?.toString().toLowerCase();
    const valB = b[sortConfig.key]?.toString().toLowerCase();
    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="users-page">
      <div className="users-header">
        <h2 className="users-title">Benutzerverwaltung</h2>
        <button className="users-back-button" onClick={() => navigate("/")}>
          ← Zurück zur Startseite
        </button>
      </div>

      {error && <p className="users-error">{error}</p>}
      {loading ? (
        <p className="users-loading">Lade Benutzer...</p>
      ) : (
        <>
          <div className="users-actions">
            <button className="users-add-button" onClick={handleCreate}>
              + Neuer Benutzer
            </button>
            <input
              className="users-search"
              type="text"
              placeholder="Benutzername, QR-Code, Rolle suchen"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <table className="users-table">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort("id")}
                  className={sortConfig.key === "id" ? "sorted" : ""}
                >
                  ID
                  <span className="sort-icon">
                    {sortConfig.key === "id"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "▲"}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("username")}
                  className={sortConfig.key === "username" ? "sorted" : ""}
                >
                  Benutzername
                  <span className="sort-icon">
                    {sortConfig.key === "username"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "▲"}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("qr_code")}
                  className={sortConfig.key === "qr_code" ? "sorted" : ""}
                >
                  QR-Code
                  <span className="sort-icon">
                    {sortConfig.key === "qr_code"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "▲"}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("role")}
                  className={sortConfig.key === "role" ? "sorted" : ""}
                >
                  Rolle
                  <span className="sort-icon">
                    {sortConfig.key === "role"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "▲"}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("created_at")}
                  className={sortConfig.key === "created_at" ? "sorted" : ""}
                >
                  Erstellt
                  <span className="sort-icon">
                    {sortConfig.key === "created_at"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "▲"}
                  </span>
                </th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.qr_code}</td>
                  <td className={`users-role users-role-${u.role}`}>
                    {u.role}
                  </td>
                  <td>{u.created_at?.slice(0, 10) || "-"}</td>
                  <td>
                    <button
                      className="users-edit-button"
                      onClick={() => handleEdit(u)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="users-delete-button"
                      onClick={() => handleDelete(u.id)}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {showForm && (
        <div className="users-modal-overlay">
          <div className="users-modal">
            <UserForm
              user={editingUser}
              onClose={() => setShowForm(false)}
              onSave={(savedUser) => {
                if (editingUser) {
                  setUsers(
                    users.map((u) => (u.id === savedUser.id ? savedUser : u))
                  );
                } else {
                  setUsers([...users, savedUser]);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;
