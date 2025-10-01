import { useState, useEffect } from "react";
import "../styles/AdminUsers.css";

const API_URL = import.meta.env.VITE_API_URL;

function UserForm({ user, onClose, onSave }) {
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [qrCode, setQrCode] = useState(user?.qr_code || "");
  const [role, setRole] = useState(user?.role || "user");
  const [roles, setRoles] = useState([]);
  const [currentUsername, setCurrentUsername] = useState(null);

  const isEditing = !!user?.id;

  useEffect(() => {
    fetch(`${API_URL}/api/me`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setCurrentUsername(data.username))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/roles`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setRoles(data))
      .catch(() => setRoles(["admin", "supervisor", "user", "guest"]));
  }, []);

  useEffect(() => {
    if (!isEditing) {
      fetch(`${API_URL}/api/users/next-id`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
        .then((res) => res.json())
        .then((data) => setQrCode(data.next_qr))
        .catch(() => setQrCode("usr0001"));
    }
  }, [isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isEditing && currentUsername === username && role !== user.role) {
      alert("Du kannst deine eigene Rolle nicht ändern.");
      return;
    }

    const payload = {
      username,
      role,
      qr_code: qrCode,
      ...(password ? { password } : {}),
    };

    const url = isEditing
      ? `${API_URL}/api/users/${user.id}`
      : `${API_URL}/api/users`;
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const updated = await res.json();
      onSave(updated);
      onClose();
    } else {
      alert("Fehler beim Speichern.");
    }
  };

  return (
    <div className="user-form-overlay">
      <div className="user-form-modal">
        <h3 className="user-form-title">
          {isEditing ? "Benutzer bearbeiten" : "Neuer Benutzer"}
        </h3>
        <form className="user-form" onSubmit={handleSubmit}>
          <label className="user-form-label">
            Benutzername:
            <input
              className="user-form-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          {!isEditing && (
            <label className="user-form-label">
              Passwort:
              <input
                className="user-form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          )}

          {isEditing && (
            <label className="user-form-label">
              Neues Passwort (optional):
              <input
                className="user-form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          <label className="user-form-label">
            Rolle:
            <select
              className="user-form-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={currentUsername === username}
            >
              {roles.map((r) => (
                <option key={r.id || r} value={r.name || r}>
                  {r.name || r}
                </option>
              ))}
            </select>
          </label>

          <label className="user-form-label">
            QR-Code:
            <input
              className="user-form-input"
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              required
              disabled
            />
          </label>

          <div className="user-form-buttons">
            <button type="submit" className="user-form-save-button">
              Speichern
            </button>
            <button
              type="button"
              className="user-form-cancel-button"
              onClick={onClose}
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UserForm;
