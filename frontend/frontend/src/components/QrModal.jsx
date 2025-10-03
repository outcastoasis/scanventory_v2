// frontend/src/components/QrModal.jsx
import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import "../styles/QrModal.css";

/**
 * Universelles QR-Modal:
 * - user?:       { qr_code, first_name?, last_name?, company_name? }
 * - tool?:       { qr_code, name?, category? }
 * - permission?: { id, key }
 * - onClose:     () => void
 */
function QrModal({ user, tool, permission, onClose }) {
  const canvasRef = useRef(null);

  const mode = user ? "user" : tool ? "tool" : permission ? "permission" : null;
  const item = user || tool || permission;

  const code =
    mode === "permission" ? permission?.key || "" : item?.qr_code || "";

  const line1 =
    mode === "user"
      ? `${item.first_name || ""} ${item.last_name || ""}`.trim()
      : mode === "tool"
      ? item.name || ""
      : mode === "permission"
      ? "Permission"
      : "";

  const line2 =
    mode === "user"
      ? item.company_name || ""
      : mode === "tool"
      ? item.category || ""
      : "";

  const title =
    mode === "user"
      ? `QR-Code für ${line1}`
      : mode === "tool"
      ? `QR-Code für ${line1}`
      : `QR-Code für Recht "${permission?.key || ""}"`;

  const filename =
    mode === "user"
      ? `${item.qr_code}_${item.company_name || ""}_${item.first_name || ""}_${
          item.last_name || ""
        }.png`
      : mode === "tool"
      ? `${item.qr_code}_${item.name || ""}.png`
      : `permission_${permission?.key || "key"}.png`;

  useEffect(() => {
    if (!code || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const qrSize = 200,
      padding = 20;

    ctx.font = "bold 25px Arial";
    const nameWidth = ctx.measureText(line1).width;

    ctx.font = "20px Arial";
    const codeWidth = ctx.measureText(code).width;
    const extraWidth = line2 ? ctx.measureText(line2).width : 0;

    const maxTextWidth = Math.max(codeWidth, nameWidth, extraWidth);
    const canvasWidth = qrSize + padding * 3 + maxTextWidth;
    const canvasHeight = 250;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Hintergrund
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // QR erzeugen & zeichnen
    const qrCanvas = document.createElement("canvas");
    QRCode.toCanvas(qrCanvas, code, { width: qrSize, margin: 1 }).then(() => {
      ctx.drawImage(qrCanvas, padding, 20);

      const textX = qrSize + padding * 2,
        textY = 100;

      // weiße Box hinter Text
      const boxPadding = 12,
        textBoxWidth = maxTextWidth + boxPadding * 2,
        textBoxHeight = 90;
      ctx.fillStyle = "white";
      ctx.fillRect(textX - boxPadding, textY - 40, textBoxWidth, textBoxHeight);

      // Text
      ctx.fillStyle = "black";
      ctx.font = "20px Arial";
      ctx.fillText(code, textX, textY);
      if (line1) {
        ctx.font = "bold 25px Arial";
        ctx.fillText(line1, textX, textY + 30);
      }
      if (line2) {
        ctx.font = "20px Arial";
        ctx.fillText(line2, textX, textY + 60);
      }
    });
  }, [code, line1, line2]);

  if (!mode) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.download = filename.replace(/\s+/g, "_");
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <canvas ref={canvasRef} className="qr-canvas" />
        <div className="qr-actions">
          <button onClick={handleDownload}>Herunterladen</button>
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

export default QrModal;
