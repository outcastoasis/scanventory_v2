import { useEffect, useRef } from "react";

const ScannerHandler = ({ onScan }) => {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(Date.now());

  useEffect(() => {
    const handleKeyPress = (e) => {
      const now = Date.now();

      // Reset, wenn zu viel Zeit zwischen zwei Tasten vergangen ist
      if (now - lastKeyTimeRef.current > 1000) {
        bufferRef.current = "";
      }

      lastKeyTimeRef.current = now;

      // Wenn Enter oder ähnliche Taste erkannt wurde → Scan abschliessen
      if (
        e.key === "Enter" ||
        e.key === "\r" ||
        e.keyCode === 13 ||
        e.code === "NumpadEnter" ||
        e.code === "Enter"
      ) {
        const scanned = bufferRef.current.trim().replace(/^NumLock/, "");

        if (scanned !== "") {
          onScan(scanned);
        }

        bufferRef.current = "";
      } else {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [onScan]);

  return null; // Kein sichtbares UI-Element
};

export default ScannerHandler;
