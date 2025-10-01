import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL;

function UserForm({ user, onClose, onSave }) {
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [qrCode, setQrCode] = useState(user?.qr_code || "");
  const [role, setRole] = useState(user?.role || "user");
  const [roles, setRoles] = useState([]);

  const isEditing = !!user?.id;

  useEffect(() => {
    fetch(`${API_URL}/api/roles`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setRoles(data))
      .catch(() => setRoles(["admin", "supervisor", "user", "guest"])); // Fallback
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
        .catch(() => setQrCode("usr0001")); // Fallback
    }
  }, [isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    <div className="modal">
      <div className="modal-content">
        <h3>{isEditing ? "Benutzer bearbeiten" : "Neuer Benutzer"}</h3>
        <form onSubmit={handleSubmit}>
          <label>
            Benutzername:
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          {!isEditing && (
            <label>
              Passwort:
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          )}

          {isEditing && (
            <label>
              Neues Passwort (optional):
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          <label>
            Rolle:
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id || r} value={r.name || r}>
                  {r.name || r}
                </option>
              ))}
            </select>
          </label>

          <label>
            QR-Code:
            <input
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              required
            />
          </label>

          <div style={{ marginTop: "1rem" }}>
            <button type="submit">Speichern</button>
            <button
              type="button"
              onClick={onClose}
              style={{ marginLeft: "1rem" }}
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
