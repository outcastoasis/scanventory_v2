// frontend/src/pages/AdminTools.jsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import ToolForm from "../components/ToolForm";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import QRCode from "qrcode";
import QrModal from "../components/QrModal";
import "../styles/AdminTools.css";
import "../styles/ToolImportModal.css";
import { getToken } from "../utils/authUtils";
import ToolImportModal from "../components/ToolImportModal";
import AdminDropdown from "../components/AdminDropdown";

import API_URL from "../config/api";

export default function AdminTools() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentUserId, setCurrentUserId] = useState(null);
  const [qrTool, setQrTool] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error();
        const me = await res.json();
        if (me.permissions?.manage_tools !== "true") return navigate("/");
        setCurrentUserId(me.user_id);
        setPermissions(me.permissions || {});
      } catch {
        navigate("/");
      }
    };
    fetchMe();
  }, []);

  useEffect(() => {
    if (currentUserId === null) return;
    setLoading(true);
    fetch(`${API_URL}/api/tools`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Fehler beim Abrufen der Werkzeuge");
        return r.json();
      })
      .then((data) => {
        setTools(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setError("Fehler beim Laden der Werkzeuge.");
        setLoading(false);
      });
  }, [currentUserId]);

  const handleCreate = () => {
    setEditingTool(null);
    setShowForm(true);
  };
  const handleEdit = (tool) => {
    setEditingTool(tool);
    setShowForm(true);
  };
  const handleDelete = (id) => {
    if (!confirm("Werkzeug wirklich löschen?")) return;
    fetch(`${API_URL}/api/tools/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Fehler beim Löschen.");
        setTools((prev) => prev.filter((t) => t.id !== id));
      })
      .catch((err) => alert(err.message));
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc")
      direction = "desc";
    setSortConfig({ key, direction });
  };

  const filtered = tools.filter((t) => {
    const term = searchTerm.toLowerCase();
    return (
      t.id?.toString().includes(term) ||
      t.name?.toLowerCase().includes(term) ||
      t.qr_code?.toLowerCase().includes(term) ||
      t.category_name?.toLowerCase().includes(term) ||
      t.status?.toLowerCase().includes(term) ||
      t.created_at?.toLowerCase().includes(term)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const A = a[sortConfig.key]?.toString().toLowerCase() ?? "";
    const B = b[sortConfig.key]?.toString().toLowerCase() ?? "";
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    if (sortConfig.key === "id") {
      const ai = Number(a.id) || 0;
      const bi = Number(b.id) || 0;
      return (ai - bi) * dir;
    }
    if (A < B) return sortConfig.direction === "asc" ? -1 : 1;
    if (A > B) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleExportAllQR = async () => {
    const zip = new JSZip();

    // Hilfsfunktion wie in QrModal
    function wrapLines(ctx, text, maxWidth) {
      const words = text.split(" ");
      const lines = [];
      let line = "";

      for (let w of words) {
        const test = line + w + " ";
        if (ctx.measureText(test).width > maxWidth && line !== "") {
          lines.push(line.trim());
          line = w + " ";
        } else {
          line = test;
        }
      }
      if (line) lines.push(line.trim());
      return lines;
    }

    for (const tool of sorted) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const qrSize = 200;
      const padding = 20;

      const code = tool.qr_code || "";
      const line1 = tool.name || "";
      const line2 = tool.category_name || "";

      // Neue Werte aus QrModal
      const maxWidth = 450;
      const lineHeight = 34;
      const DPI_SCALE = 3;

      // Zeilen berechnen
      ctx.font = "26px Arial";
      const codeLines = wrapLines(ctx, code, maxWidth);

      ctx.font = "bold 40px Arial";
      const nameLines = wrapLines(ctx, line1, maxWidth);

      ctx.font = "26px Arial";
      const catLines = line2 ? wrapLines(ctx, line2, maxWidth) : [];

      const allLines = [
        ...codeLines.map((t) => ({ text: t, font: "26px Arial" })),
        ...nameLines.map((t) => ({ text: t, font: "bold 40px Arial" })),
        ...catLines.map((t) => ({ text: t, font: "26px Arial" })),
      ];

      // Gesamthöhe berechnen
      const totalTextHeight = allLines.length * lineHeight;

      // ----- DYNAMISCHE TEXTBREITE -----
      let longestWidth = 0;
      for (const line of allLines) {
        ctx.font = line.font;
        const w = ctx.measureText(line.text).width;
        if (w > longestWidth) longestWidth = w;
      }

      // Canvas width = QR + padding + tatsächliche Textbreite
      const dynamicTextWidth = longestWidth;
      const canvasWidth = qrSize + padding * 3 + dynamicTextWidth;

      // Canvas height bleibt wie vorher
      const availableHeight = Math.max(260, totalTextHeight + 80);

      // DPI-Skalierter Canvas
      canvas.width = canvasWidth * DPI_SCALE;
      canvas.height = availableHeight * DPI_SCALE;
      ctx.scale(DPI_SCALE, DPI_SCALE);

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvasWidth, availableHeight);

      // QR-Code randlos
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, code, { width: qrSize, margin: 0 });
      ctx.drawImage(qrCanvas, padding, (availableHeight - qrSize) / 2);

      // Vertikal zentrierter Text
      const textX = qrSize + padding * 2;
      let y = (availableHeight - totalTextHeight) / 2;

      for (const line of allLines) {
        ctx.font = line.font;
        ctx.fillStyle = "black";
        ctx.fillText(line.text, textX, y);
        y += lineHeight;
      }

      const dataUrl = canvas.toDataURL("image/png");
      const filename = `${tool.qr_code}_${tool.name.replace(/\s+/g, "_")}.png`;
      zip.file(filename, dataUrl.split(",")[1], { base64: true });
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "tool_qr_codes.zip");
  };

  const handleExportCsvTemplate = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tools/template`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Fehler beim Export der Vorlage");
      const blob = await res.blob();
      saveAs(blob, "werkzeug_vorlage.csv");
    } catch (err) {
      alert("Export fehlgeschlagen: " + err.message);
    }
  };

  const fetchTools = () => {
    setLoading(true);
    fetch(`${API_URL}/api/tools`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Fehler beim Abrufen der Werkzeuge");
        return r.json();
      })
      .then((data) => {
        setTools(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setError("Fehler beim Laden der Werkzeuge.");
        setLoading(false);
      });
  };

  return (
    <div className="tools-page">
      <div className="tools-header">
        <h2 className="tools-title">Werkzeugverwaltung</h2>
        <div className="tools-header-actions">
          <AdminDropdown permissions={permissions} />
          <button className="tools-back-button" onClick={() => navigate("/")}>
            ← Zurück zur Startseite
          </button>
        </div>
      </div>

      {error && <p className="tools-error">{error}</p>}
      {loading ? (
        <p className="tools-loading">Lade Werkzeuge...</p>
      ) : (
        <>
          {/* ---------- Aktionen / Filter ---------- */}
          <div className="tools-actions">
            <div
              className="tools-add-dropdown"
              onMouseEnter={() => setShowDropdown(true)}
              onMouseLeave={() => setShowDropdown(false)}
            >
              <button className="tools-add-button">+ Neues Werkzeug</button>

              {showDropdown && (
                <div className="tools-dropdown-menu">
                  <button onClick={handleCreate}>Einzelnes Werkzeug</button>
                  <button onClick={() => setShowImportModal(true)}>
                    CSV importieren
                  </button>
                </div>
              )}
            </div>

            <input
              className="tools-search"
              type="text"
              placeholder="Suche nach Werkzeug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <button
              className="tools-export-button"
              onClick={handleExportAllQR}
              disabled={permissions.export_qr_codes !== "true"}
            >
              QR-Massenexport
            </button>

            <button
              className="tools-export-button"
              onClick={handleExportCsvTemplate}
              disabled={permissions.manage_tools !== "true"}
            >
              CSV-Vorlage
            </button>
          </div>

          {/* ---------- Mobile Akkordeon-Leiste ---------- */}
          <div className="tools-mobile-header">
            <button
              className="tools-mobile-toggle"
              onClick={() =>
                document
                  .querySelector(".tools-mobile-panel")
                  .classList.toggle("open")
              }
            >
              Filter & Aktionen anzeigen
            </button>

            <div className="tools-mobile-panel">
              <button className="tools-add-button" onClick={handleCreate}>
                + Neues Werkzeug
              </button>
              <button
                className="tools-export-button"
                onClick={handleExportAllQR}
                disabled={permissions.export_qr_codes !== "true"}
              >
                QR-Massenexport
              </button>
              <button
                className="tools-export-button"
                onClick={handleExportCsvTemplate}
                disabled={permissions.manage_tools !== "true"}
              >
                CSV-Vorlage
              </button>
              <input
                className="tools-search"
                type="text"
                placeholder="Suche nach Werkzeug..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <table className="tools-table">
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
                  onClick={() => handleSort("name")}
                  className={sortConfig.key === "name" ? "sorted" : ""}
                >
                  Name{" "}
                  <span className="sort-icon">
                    {sortConfig.key === "name"
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
                  onClick={() => handleSort("category_name")}
                  className={sortConfig.key === "category_name" ? "sorted" : ""}
                >
                  Kategorie{" "}
                  <span className="sort-icon">
                    {sortConfig.key === "category_name"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : "▲"}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className={sortConfig.key === "status" ? "sorted" : ""}
                >
                  Status{" "}
                  <span className="sort-icon">
                    {sortConfig.key === "status"
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
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.name}</td>
                  <td>{t.qr_code}</td>
                  <td>{t.category_name || "-"}</td>
                  <td
                    className={`tools-status ${
                      t.is_borrowed ? "borrowed" : "available"
                    }`}
                  >
                    {t.is_borrowed
                      ? "ausgeliehen"
                      : t.status === "available" || !t.status
                      ? "verfügbar"
                      : t.status}
                  </td>

                  <td>{t.created_at?.slice(0, 10) || "-"}</td>
                  <td>
                    <button
                      className="tools-edit-button"
                      onClick={() => handleEdit(t)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="tools-delete-button"
                      onClick={() => handleDelete(t.id)}
                    >
                      Löschen
                    </button>
                    <button
                      className="tools-qr-button"
                      onClick={() => setQrTool(t)}
                    >
                      QR anzeigen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* === Mobile Card Ansicht === */}
          <div className="tools-list-mobile">
            {sorted.map((t) => (
              <div className="tool-card" key={t.id}>
                <div className="tool-card-header">
                  <h3>{t.name}</h3>
                  <span
                    className={`tool-status ${
                      t.is_borrowed ? "borrowed" : "available"
                    }`}
                  >
                    {t.is_borrowed
                      ? "ausgeliehen"
                      : t.status === "available" || !t.status
                      ? "verfügbar"
                      : t.status}
                  </span>
                </div>
                <div className="tool-card-body">
                  <p>
                    <strong>ID:</strong> {t.id}
                  </p>
                  <p>
                    <strong>QR-Code:</strong> {t.qr_code}
                  </p>
                  <p>
                    <strong>Kategorie:</strong> {t.category_name || "-"}
                  </p>
                  <p>
                    <strong>Erstellt:</strong>{" "}
                    {t.created_at?.slice(0, 10) || "-"}
                  </p>
                </div>
                <div className="tool-card-actions">
                  <button
                    className="tools-edit-button"
                    onClick={() => handleEdit(t)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    className="tools-delete-button"
                    onClick={() => handleDelete(t.id)}
                  >
                    Löschen
                  </button>
                  <button
                    className="tools-qr-button"
                    onClick={() => setQrTool(t)}
                  >
                    QR anzeigen
                  </button>
                </div>
              </div>
            ))}
          </div>

          {qrTool && (
            <QrModal
              tool={qrTool}
              onClose={() => setQrTool(null)}
              canDownload={permissions.export_qr_codes === "true"}
            />
          )}
        </>
      )}

      {showForm && (
        <div className="tools-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="tools-modal" onClick={(e) => e.stopPropagation()}>
            <ToolForm
              tool={editingTool}
              onClose={() => setShowForm(false)}
              onSave={(saved) => {
                setShowForm(false);
                setTools((prev) =>
                  editingTool
                    ? prev.map((t) => (t.id === saved.id ? saved : t))
                    : [...prev, saved]
                );
              }}
            />
          </div>
        </div>
      )}
      {showImportModal && (
        <div
          className="tool-importmodal-overlay"
          onClick={() => setShowImportModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ToolImportModal
              onClose={() => {
                setShowImportModal(false);
                // Seite aktualisieren
                fetchTools();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
