// frontend/src/components/ScannerHandler.jsx
import { useEffect, useState } from "react";

const ScannerHandler = ({ onScan }) => {
  const [buffer, setBuffer] = useState("");
  const [lastKeyTime, setLastKeyTime] = useState(Date.now());

  useEffect(() => {
    const handleKeyPress = (e) => {
      const now = Date.now();

      // Falls mehr als 100ms seit letzter Taste → Buffer zurücksetzen
      if (now - lastKeyTime > 1000) {
        setBuffer("");
      }

      setLastKeyTime(now);

      if (e.key === "Enter") {
        if (buffer.trim() !== "") {
          onScan(buffer.trim());
        }
        setBuffer("");
      } else {
        setBuffer((prev) => prev + e.key);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [buffer, lastKeyTime, onScan]);

  return null; // Kein UI-Element nötig
};

export default ScannerHandler;
