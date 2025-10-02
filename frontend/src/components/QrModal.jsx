// frontend/src/components/QrModal.jsx
import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import "../styles/QrModal.css";

function QrModal({ user, onClose }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (user && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const qrSize = 200;
      const padding = 20;

      // Simuliere Textbreite
      ctx.font = "bold 25px Arial";
      const name = `${user.first_name || ""} ${user.last_name || ""}`;
      const nameWidth = ctx.measureText(name).width;

      ctx.font = "20px Arial";
      const qrCodeWidth = ctx.measureText(user.qr_code).width;
      const companyWidth = user.company_name
        ? ctx.measureText(user.company_name).width
        : 0;

      const maxTextWidth = Math.max(qrCodeWidth, nameWidth, companyWidth);

      const canvasWidth = qrSize + padding * 3 + maxTextWidth;
      const canvasHeight = 250;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Hintergrund
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // QR-Code vorbereiten
      const qrCanvas = document.createElement("canvas");
      QRCode.toCanvas(qrCanvas, user.qr_code, {
        width: qrSize,
        margin: 1,
      }).then(() => {
        ctx.drawImage(qrCanvas, padding, 20);

        const textX = qrSize + padding * 2;
        const textY = 100;

        // Hintergrund hinter Text
        const boxPadding = 12;
        const textBoxWidth = maxTextWidth + boxPadding * 2;
        const textBoxHeight = 90;
        ctx.fillStyle = "white";
        ctx.fillRect(
          textX - boxPadding,
          textY - 40,
          textBoxWidth,
          textBoxHeight
        );

        // Text zeichnen
        ctx.fillStyle = "black";
        ctx.font = "20px Arial";
        ctx.fillText(user.qr_code, textX, textY);
        ctx.font = "bold 25px Arial";
        ctx.fillText(name, textX, textY + 30);
        ctx.font = "20px Arial";
        if (user.company_name)
          ctx.fillText(user.company_name, textX, textY + 60);
      });
    }
  }, [user]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = `${user.qr_code}_${user.company_name || ""}_${
      user.first_name || ""
    }_${user.last_name || ""}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="qr-modal-overlay">
      <div className="qr-modal">
        <h3>
          QR-Code für {user.first_name} {user.last_name}
        </h3>
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
