// frontend/src/components/ToolForm.jsx
import { useState, useEffect } from "react";
import "../styles/AdminTools.css";
import { getToken } from "../utils/authUtils";

const API_URL = import.meta.env.VITE_API_URL;

export default function ToolForm({ tool, onClose, onSave }) {
  const isEditing = !!tool?.id;

  const [name, setName] = useState(tool?.name || "");
  const [qrCode, setQrCode] = useState(tool?.qr_code || "");
  const [categoryId, setCategoryId] = useState(tool?.category_id || "");
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // QR-Code automatisch generieren (bei neuem Tool)
  useEffect(() => {
    if (isEditing) return;
    fetch(`${API_URL}/api/tools/next-id`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d) => setQrCode(d?.next_qr || "tool0001"))
      .catch(() => setQrCode("tool0001"));
  }, [isEditing]);

  // Kategorien abrufen
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/api/categories`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error("Fehler beim Laden der Kategorien");
        const data = await res.json();
        setCategories(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // Formular absenden
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name,
      qr_code: qrCode,
      category_id: categoryId || null,
    };

    const url = isEditing
      ? `${API_URL}/api/tools/${tool.id}`
      : `${API_URL}/api/tools`;
    const method = isEditing ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Speichern fehlgeschlagen.");
      onSave(data);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="tool-form" onSubmit={submit}>
      <h3 className="tool-form-title">
        {isEditing ? "Werkzeug bearbeiten" : "Neues Werkzeug"}
      </h3>

      <label className="tool-form-label">
        Name*:
        <input
          className="tool-form-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </label>

      <label className="tool-form-label">
        Kategorie:
        {loadingCategories ? (
          <p className="tool-form-loading">Lade Kategorien...</p>
        ) : (
          <select
            className="tool-form-select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">– Keine Kategorie –</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="tool-form-label">
        QR-Code:
        <input
          className="tool-form-input"
          type="text"
          value={qrCode}
          onChange={(e) => setQrCode(e.target.value)}
          required
          disabled
        />
      </label>

      <div className="tool-form-buttons">
        <button
          className="tool-form-save-button"
          type="submit"
          disabled={saving}
        >
          {saving ? "Speichern..." : "Speichern"}
        </button>
        <button
          className="tool-form-cancel-button"
          type="button"
          onClick={onClose}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
