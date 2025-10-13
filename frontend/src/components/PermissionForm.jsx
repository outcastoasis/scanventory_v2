// frontend/src/components/PermissionForm.jsx
import { useEffect, useState } from "react";
import "../styles/AdminPermissions.css";
import { getToken } from "../utils/authUtils";

const API_URL = import.meta.env.VITE_API_URL;

export default function PermissionForm({ permission, onClose, onSave }) {
  const [keyVal, setKeyVal] = useState(permission?.key || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!keyVal.trim()) {
      alert("Key darf nicht leer sein.");
      return;
    }
    setSaving(true);
    try {
      const url = `${API_URL}/api/permissions`;
      const method = "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ key: keyVal.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      onSave(data);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="permission-form" onSubmit={handleSubmit}>
      <h3 className="permission-form-title">Neues Recht</h3>

      <label className="permission-form-label">
        Permission-Key*
        <input
          className="permission-form-input"
          type="text"
          value={keyVal}
          onChange={(e) => setKeyVal(e.target.value)}
          placeholder='z. B. "manage_users"'
          required
          autoFocus
        />
      </label>
      <div className="permission-form-buttons">
        <button
          type="submit"
          className="permission-form-save-button"
          disabled={saving}
        >
          {saving ? "Speichern..." : "Speichern"}
        </button>
        <button
          type="button"
          className="permission-form-cancel-button"
          onClick={onClose}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
