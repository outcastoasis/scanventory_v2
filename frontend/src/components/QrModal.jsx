// frontend/src/components/QrModal.jsx
import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import "../styles/QrModal.css";

function QrModal({ user, tool, onClose, canDownload = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const subject = user || tool;
    if (!subject || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const qrSize = 200;
    const padding = 20;

    const line1 = user
      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
      : tool?.name || "";

    const lineUsername = user ? (user.username || "").trim() : "";
    const line2 = user ? user.company_name : tool?.category_name || "";
    const code = subject.qr_code || "";

    // --------- Hilfsfunktion für Zeilenumbruch ----------
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

    // ---------- spätere Umbrüche ----------
    const maxWidth = 450;
    const lineHeight = 34;

    // ---------------- VORAB: Zeilen berechnen ----------------
    ctx.font = "26px Arial";
    const codeLines = wrapLines(ctx, code, maxWidth);

    ctx.font = "bold 40px Arial";
    const nameLines = wrapLines(ctx, line1, maxWidth);

    ctx.font = "italic 26px Arial";
    const usernameLines = lineUsername
      ? wrapLines(ctx, lineUsername, maxWidth)
      : [];

    ctx.font = "26px Arial";
    const catLines = line2 ? wrapLines(ctx, line2, maxWidth) : [];

    const allLines = [
      ...codeLines.map((t) => ({ text: t, font: "26px Arial" })),
      ...nameLines.map((t) => ({ text: t, font: "bold 40px Arial" })),
      ...usernameLines.map((t) => ({ text: t, font: "italic 26px Arial" })),
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

    const DPI_SCALE = 3;

    canvas.width = canvasWidth * DPI_SCALE;
    canvas.height = availableHeight * DPI_SCALE;

    ctx.scale(DPI_SCALE, DPI_SCALE);

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, availableHeight);

    // QR zeichnen – maximal gefüllt
    const qrCanvas = document.createElement("canvas");

    QRCode.toCanvas(qrCanvas, code, { width: qrSize, margin: 0 }).then(() => {
      ctx.drawImage(qrCanvas, padding, (availableHeight - qrSize) / 2);

      // ---------- Vertikale Zentrierung ----------
      const textX = qrSize + padding * 2;
      const startY = (availableHeight - totalTextHeight) / 2;

      let y = startY;

      // ---------- Text zeichnen ----------
      for (const line of allLines) {
        ctx.font = line.font;
        ctx.fillStyle = "black";
        ctx.fillText(line.text, textX, y);
        y += lineHeight;
      }
    });
  }, [user, tool]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const base = user
      ? `${user.qr_code}_${user.company_name}_${user.first_name || ""}_${
          user.last_name || ""
        }`
      : `${tool?.qr_code || "tool"}_${(tool?.name || "").replace(
          /\s+/g,
          "_"
        )}_${(tool?.category_name || "").replace(/\s+/g, "_")}`;
    const link = document.createElement("a");
    link.download = `${base}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const title = user
    ? `QR-Code für ${user.first_name || ""} ${user.last_name || ""}`.trim()
    : `QR-Code: ${tool?.name || ""}`;

  return (
    <div className="qr-modal-overlay">
      <div className="qr-modal">
        <h3>{title}</h3>
        <canvas ref={canvasRef} className="qr-canvas" />
        <div className="qr-actions">
          <button
            onClick={handleDownload}
            disabled={!canDownload}
            title={
              canDownload
                ? "QR-Code herunterladen"
                : "Keine Berechtigung zum Herunterladen"
            }
          >
            Herunterladen
          </button>
          <button onClick={onClose}>Schliessen</button>
        </div>
      </div>
    </div>
  );
}

export default QrModal;
