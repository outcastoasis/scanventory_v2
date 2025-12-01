// frontend/src/components/StaticQrCodesTable.jsx
import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { getToken } from "../utils/authUtils";
import "../styles/QrModal.css";

const staticCodes = [
  {
    id: 1,
    name: "reload",
    qr_code: "reload",
    title: "reload → Seite aktualisieren",
  },
  {
    id: 2,
    name: "cancel",
    qr_code: "cancel",
    title: "cancel → Abbruch",
  },
  {
    id: 3,
    name: "Mobile-Ansicht",
    qr_code: "http://server-scanventory/mobile",
    title: "Mobile-Ansicht → Heutige Reservationen",
  },
];

import API_URL from "../config/api";

function StaticQrCodesTable() {
  const [selectedCode, setSelectedCode] = useState(null);
  const [permissions, setPermissions] = useState({});
  const canvasRef = useRef(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        setPermissions(data.permissions || {});
      } catch (err) {
        console.error("Fehler beim Laden der Berechtigungen:", err);
      }
    };

    fetchPermissions();
  }, []);

  useEffect(() => {
    if (!selectedCode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const title = selectedCode.title;
    const code = selectedCode.qr_code;
    const qrSize = 200;
    const padding = 20;

    const ctx = canvas.getContext("2d");
    ctx.font = "bold 22px Arial";
    const titleWidth = ctx.measureText(title).width;

    const canvasWidth = Math.max(
      qrSize + padding * 2,
      titleWidth + padding * 2
    );
    const canvasHeight = qrSize + 80;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Hintergrund
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Titel
    ctx.fillStyle = "black";
    ctx.font = "bold 22px Arial";
    ctx.fillText(title, (canvasWidth - titleWidth) / 2, 30);

    // QR generieren
    const qrCanvas = document.createElement("canvas");
    QRCode.toCanvas(qrCanvas, code, { width: qrSize, margin: 1 }).then(() => {
      ctx.drawImage(qrCanvas, (canvasWidth - qrSize) / 2, 40);
    });
  }, [selectedCode]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = `${selectedCode.name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="adminpanel-section">
      <h3 className="adminpanel-section-title">Spezielle QR-Codes</h3>
      <table className="adminpanel-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {staticCodes.map((code) => (
            <tr key={code.id}>
              <td>{code.id}</td>
              <td>{code.name}</td>
              <td>
                <button onClick={() => setSelectedCode(code)}>
                  QR anzeigen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Spezielle QR-Codes (Mobile Kartenansicht) */}
      <div className="adminpanel-list-mobile">
        {staticCodes.map((code) => (
          <div className="adminpanel-card" key={code.id}>
            <div className="adminpanel-card-header">
              <h3>{code.name}</h3>
              <span>ID {code.id}</span>
            </div>
            <div className="adminpanel-card-body">
              <p>
                <strong>Beschreibung:</strong> {code.title}
              </p>
            </div>
            <div className="adminpanel-card-actions">
              <button
                className="tools-edit-button"
                onClick={() => setSelectedCode(code)}
              >
                QR anzeigen
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedCode && (
        <div className="qr-modal-overlay">
          <div className="qr-modal">
            <canvas ref={canvasRef} className="qr-canvas" />
            <div className="qr-actions">
              {permissions.export_qr_codes === "true" ? (
                <button onClick={handleDownload}>Herunterladen</button>
              ) : (
                <button disabled title="Keine Berechtigung zum Herunterladen">
                  Herunterladen
                </button>
              )}
              <button onClick={() => setSelectedCode(null)}>Schliessen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaticQrCodesTable;
