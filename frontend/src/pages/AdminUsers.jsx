// frontend/src/pages/AdminUsers.jsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import UserForm from "../components/UserForm";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import QRCode from "qrcode";
import QrModal from "../components/QrModal";
import "../styles/AdminUsers.css";
import { getToken } from "../utils/authUtils";
import UserImportModal from "../components/UserImportModal";
import AdminDropdown from "../components/AdminDropdown";

import API_URL from "../config/api";

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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
          setPermissions(data.permissions || {});
        }
      } catch (err) {
        navigate("/");
      }
    };

    fetchCurrentUser();
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    fetch(`${API_URL}/api/users`, {
      headers: { Authorization: `Bearer ${getToken()}` },
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
  };

  useEffect(() => {
    if (currentUserId === null) return;
    fetchUsers();
  }, [currentUserId]);

  const handleDelete = (id) => {
    if (!currentUserId) {
      alert("Benutzerdaten noch nicht geladen.");
      return;
    }

    if (confirm("Benutzer wirklich löschen?")) {
      fetch(`${API_URL}/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      })
        .then(async (res) => {
          let data = {};
          try {
            data = await res.json();
          } catch (e) {
            // Falls Backend nichts sendet
          }

          if (!res.ok) {
            // Backend sendet: { error: "..."}
            alert(data.error || "Löschen nicht möglich.");
            return;
          }

          // Erfolgreich → UI aktualisieren
          setUsers(users.filter((u) => u.id !== id));
        })
        .catch((err) => {
          // Netzwerkfehler / CORS / Server down
          alert("Serverfehler: " + err.message);
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
      (u.first_name && u.first_name.toLowerCase().includes(term)) ||
      (u.last_name && u.last_name.toLowerCase().includes(term)) ||
      (u.company_name && u.company_name.toLowerCase().includes(term)) ||
      u.qr_code.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term) ||
      (u.created_at && u.created_at.toLowerCase().includes(term))
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const valA = a[sortConfig.key]?.toString().toLowerCase();
    const valB = b[sortConfig.key]?.toString().toLowerCase();
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    if (sortConfig.key === "id") {
      const ai = Number(a.id) || 0;
      const bi = Number(b.id) || 0;
      return (ai - bi) * dir;
    }
    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleExportAllQR = async () => {
    const zip = new JSZip();

    for (const user of sortedUsers) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const qrSize = 200;
      const padding = 20;

      // Textbreiten vorher messen
      ctx.font = "bold 25px Arial";
      const name = `${user.first_name || ""} ${user.last_name || ""}`;
      const nameWidth = ctx.measureText(name).width;

      ctx.font = "20px Arial";
      const qrCodeWidth = ctx.measureText(user.qr_code).width;
      const companyWidth = user.company_name
        ? ctx.measureText(user.company_name).width
        : 0;

      const maxTextWidth = Math.max(qrCodeWidth, nameWidth, companyWidth);

      // Dynamische Breite
      const canvasWidth = qrSize + padding * 3 + maxTextWidth;
      const canvasHeight = 250;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Hintergrund komplett weiss
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // QR Code vorbereiten und zeichnen
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, user.qr_code, {
        width: qrSize,
        margin: 1,
      });
      ctx.drawImage(qrCanvas, padding, 20);

      const textX = qrSize + padding * 2;
      const textY = 100;

      // Weisser Hintergrund hinter Textbereich
      const boxPadding = 12;
      const textBoxWidth = maxTextWidth + boxPadding * 2;
      const textBoxHeight = 90;
      ctx.fillStyle = "white";
      ctx.fillRect(textX - boxPadding, textY - 40, textBoxWidth, textBoxHeight);

      // Text zeichnen
      ctx.fillStyle = "black";
      ctx.font = "20px Arial";
      ctx.fillText(user.qr_code, textX, textY);
      ctx.font = "bold 25px Arial";
      ctx.fillText(name, textX, textY + 30);
      ctx.font = "20px Arial";
      if (user.company_name) ctx.fillText(user.company_name, textX, textY + 60);

      // Export vorbereiten
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const filename = `${user.qr_code}_${user.company_name || ""}_${
        user.first_name || ""
      }_${user.last_name || ""}.png`;
      zip.file(filename, base64, { base64: true });
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "qr_codes.zip");
  };

  const handleExportCsvTemplate = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/template`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Fehler beim Export der Vorlage");
      const blob = await res.blob();
      saveAs(blob, "benutzer_vorlage.csv");
    } catch (err) {
      alert("Export fehlgeschlagen: " + err.message);
    }
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <h2 className="users-title">Benutzerverwaltung</h2>
        <div className="users-header-actions">
          <AdminDropdown permissions={permissions} />
          <button className="users-back-button" onClick={() => navigate("/")}>
            ← Zurück zur Startseite
          </button>
        </div>
      </div>

      {error && <p className="users-error">{error}</p>}
      {loading ? (
        <p className="users-loading">Lade Benutzer...</p>
      ) : (
        <>
          <div className="users-actions">
            <div
              className="users-add-dropdown"
              onMouseEnter={() => setShowDropdown(true)}
              onMouseLeave={() => setShowDropdown(false)}
            >
              <button className="users-add-button">+ Neuer Benutzer</button>

              {showDropdown && (
                <div className="users-dropdown-menu">
                  <button onClick={handleCreate}>Einzeln erfassen</button>
                  <button onClick={() => setShowImportModal(true)}>
                    CSV importieren
                  </button>
                </div>
              )}
            </div>

            <input
              className="users-search"
              type="text"
              placeholder="Suche nach Benutzer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              className="users-export-button"
              onClick={handleExportAllQR}
              disabled={permissions.export_qr_codes !== "true"}
              title={
                permissions.export_qr_codes === "true"
                  ? "QR-Codes exportieren"
                  : "Keine Berechtigung für Export"
              }
            >
              QR-Massenexport
            </button>
            <button
              className="users-export-button"
              onClick={handleExportCsvTemplate}
              disabled={permissions.manage_users !== "true"}
              title={
                permissions.manage_users === "true"
                  ? "CSV-Vorlage herunterladen"
                  : "Keine Berechtigung"
              }
            >
              CSV-Vorlage
            </button>
          </div>

          {/* ---------- Mobile Header Akkordeon ---------- */}
          <div className="users-mobile-header">
            <button
              className="users-mobile-toggle"
              onClick={() =>
                document
                  .querySelector(".users-mobile-panel")
                  .classList.toggle("open")
              }
            >
              Filter & Aktionen anzeigen
            </button>

            <div className="users-mobile-panel">
              <button className="users-add-button" onClick={handleCreate}>
                + Neuer Benutzer
              </button>
              <button
                className="users-export-button"
                onClick={handleExportAllQR}
                disabled={permissions.export_qr_codes !== "true"}
              >
                QR-Massenexport
              </button>
              <button
                className="users-export-button"
                onClick={handleExportCsvTemplate}
                disabled={permissions.manage_users !== "true"}
              >
                CSV-Vorlage
              </button>
              <input
                className="users-search"
                type="text"
                placeholder="Suche nach Benutzer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* ---------- Mobile Card Ansicht ---------- */}
          <div className="users-list-mobile">
            {sortedUsers.map((u) => (
              <div className="user-card" key={u.id}>
                <div className="user-card-header">
                  <h3>
                    {u.first_name || "-"} {u.last_name || "-"}
                  </h3>
                  <span className={`user-role-tag ${u.role}`}>{u.role}</span>
                </div>
                <div className="user-card-body">
                  <p>
                    <strong>ID:</strong> {u.id}
                  </p>
                  <p>
                    <strong>Benutzername:</strong> {u.username}
                  </p>
                  <p>
                    <strong>Firma:</strong> {u.company_name || "-"}
                  </p>
                  <p>
                    <strong>QR-Code:</strong> {u.qr_code}
                  </p>
                  <p>
                    <strong>Erstellt:</strong>{" "}
                    {u.created_at?.slice(0, 10) || "-"}
                  </p>
                </div>
                <div className="user-card-actions">
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
                  <button
                    className="users-qr-button"
                    onClick={() => setSelectedUser(u)}
                  >
                    QR anzeigen
                  </button>
                </div>
              </div>
            ))}
          </div>

          <table className="users-table">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort("id")}
                  className={sortConfig.key === "id" ? "sorted" : ""}
                >
                  ID{" "}
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
                  Benutzername{" "}
                  <span className="sort-icon">
                    {sortConfig.key === "username"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "▲"}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("first_name")}
                  className={sortConfig.key === "first_name" ? "sorted" : ""}
                >
                  Vorname{" "}
                  <span className="sort-icon">
                    {sortConfig.key === "first_name"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "▲"}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("last_name")}
                  className={sortConfig.key === "last_name" ? "sorted" : ""}
                >
                  Nachname{" "}
                  <span className="sort-icon">
                    {sortConfig.key === "last_name"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "▲"}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("company_name")}
                  className={sortConfig.key === "company_name" ? "sorted" : ""}
                >
                  Firma{" "}
                  <span className="sort-icon">
                    {sortConfig.key === "company_name"
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
                  QR-Code{" "}
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
                  Rolle{" "}
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
                  Erstellt{" "}
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
                  <td>{u.first_name || "-"}</td>
                  <td>{u.last_name || "-"}</td>
                  <td>{u.company_name || "-"}</td>
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
                    <button
                      className="users-qr-button"
                      onClick={() => setSelectedUser(u)}
                    >
                      QR anzeigen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedUser && (
            <QrModal
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              canDownload={permissions.export_qr_codes === "true"}
            />
          )}
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
      {showImportModal && (
        <div
          className="user-importmodal-overlay"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="user-importmodal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <UserImportModal
              onClose={() => {
                setShowImportModal(false);
                fetchUsers();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;
