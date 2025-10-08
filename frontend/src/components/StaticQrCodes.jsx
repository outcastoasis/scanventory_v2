import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import "../styles/StaticQrCodes.css";

function StaticQrCodes() {
  const returnCanvasRef = useRef(null);

  useEffect(() => {
    if (returnCanvasRef.current) {
      QRCode.toCanvas(returnCanvasRef.current, "return", {
        width: 120,
        margin: 1,
      });
    }
  }, []);

  return (
    <div className="static-qr-wrapper">
      <canvas ref={returnCanvasRef} title="Rückgabe-QR-Code" />
    </div>
  );
}

export default StaticQrCodes;
