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
    const line2 = user ? user.company_name || "" : tool?.category_name || "";
    const code = subject.qr_code || "";

    // Breiten schätzen
    ctx.font = "bold 25px Arial";
    const nameWidth = ctx.measureText(line1).width;

    ctx.font = "20px Arial";
    const codeWidth = ctx.measureText(code).width;
    const extraWidth = line2 ? ctx.measureText(line2).width : 0;

    const maxTextWidth = Math.max(nameWidth, codeWidth, extraWidth);

    const canvasWidth = qrSize + padding * 3 + maxTextWidth;
    const canvasHeight = 250;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Hintergrund
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // QR zeichnen
    const qrCanvas = document.createElement("canvas");
    QRCode.toCanvas(qrCanvas, code, { width: qrSize, margin: 1 }).then(() => {
      ctx.drawImage(qrCanvas, padding, 20);

      const textX = qrSize + padding * 2;
      const textY = 100;

      // Weißer Kasten hinter Text
      const boxPadding = 12;
      const textBoxWidth = maxTextWidth + boxPadding * 2;
      const textBoxHeight = 90;
      ctx.fillStyle = "white";
      ctx.fillRect(textX - boxPadding, textY - 40, textBoxWidth, textBoxHeight);

      // Text
      ctx.fillStyle = "black";
      ctx.font = "20px Arial";
      ctx.fillText(code, textX, textY);
      ctx.font = "bold 25px Arial";
      ctx.fillText(line1, textX, textY + 30);
      ctx.font = "20px Arial";
      if (line2) ctx.fillText(line2, textX, textY + 60);
    });
  }, [user, tool]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const base = user
      ? `${user.qr_code}_${user.company_name || ""}_${user.first_name || ""}_${
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
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

export default QrModal;
