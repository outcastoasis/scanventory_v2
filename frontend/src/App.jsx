// frontend/src/App.jsx
import { useState, useEffect } from "react";
import ScannerHandler from "./components/ScannerHandler";
import "./App.css";

function App() {
  const [scanState, setScanState] = useState({
    user: null,
    tool: null,
    duration: null,
  });

  const [message, setMessage] = useState("");
  const [reservations, setReservations] = useState([]);
  const [returnMode, setReturnMode] = useState(false);

  const handleScan = (scannedCode) => {
    const code = scannedCode.toLowerCase();

    const allowedPrefixes = [
      "usr",
      "tool",
      "dur",
      "cancel",
      "reload",
      "return",
    ];
    const isValidPrefix = allowedPrefixes.some((prefix) =>
      code.startsWith(prefix)
    );
    if (!isValidPrefix) return;

    if (code === "cancel") {
      setReturnMode(false);
      resetScan("Vorgang abgebrochen.");
      return;
    }

    if (code === "reload") {
      window.location.reload();
      return;
    }

    if (code === "return") {
      setReturnMode(true);
      resetScan("Rückgabemodus aktiviert – bitte Werkzeug scannen");
      return;
    }

    if (code.startsWith("usr")) {
      setReturnMode(false);
      setScanState({ user: code, tool: null, duration: null });
      setMessage(`Benutzer erkannt: ${code}`);
      return;
    }

    if (code.startsWith("tool")) {
      const toolCode = code;

      if (returnMode) {
        // Rückgabe-Modus aktiv
        fetch("http://localhost:5050/api/reservations/return-tool", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: toolCode }),
        })
          .then((res) => {
            if (res.status === 200) return res.json();
            throw new Error("Keine aktive Ausleihe gefunden");
          })
          .then((data) => {
            setMessage(`✅ Rückgabe abgeschlossen für ${toolCode}`);
            setReturnMode(false);
            resetScan();
            fetchReservations();
          })
          .catch((err) => {
            setMessage(`❌ Rückgabe fehlgeschlagen: ${err.message}`);
            setReturnMode(false);
            resetScan();
          });

        return;
      }

      // Normale Ausleihe (tool nur scannbar nach user)
      if (scanState.user) {
        setScanState((prev) => ({ ...prev, tool: toolCode }));
        setMessage(`Werkzeug erkannt: ${toolCode}`);
      } else {
        setMessage("Bitte zuerst Benutzer scannen");
      }

      return;
    }

    if (code.startsWith("dur") && scanState.user && scanState.tool) {
      const durationDays = parseInt(code.replace("dur", ""));
      if (!isNaN(durationDays)) {
        const newState = { ...scanState, duration: durationDays };
        setScanState(newState);
        setMessage(`Dauer erkannt: ${durationDays} Tag(e)`);

        fetch("http://localhost:5050/api/reservations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user: newState.user,
            tool: newState.tool,
            duration: newState.duration,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            console.log("Serverantwort:", data);
            resetScan("Reservation gespeichert ✅");
            fetchReservations();
          })
          .catch((err) => {
            console.error("Fehler beim Speichern:", err);
            resetScan("Fehler bei der Reservation ❌");
          });

        return;
      }
    }

    setMessage(`Ungültiger Scan oder falsche Reihenfolge: ${scannedCode}`);
  };

  const resetScan = (msg = "") => {
    setScanState({ user: null, tool: null, duration: null });
    if (msg) setMessage(msg);
  };

  const fetchReservations = () => {
    fetch("http://localhost:5050/api/reservations")
      .then((res) => res.json())
      .then((data) => setReservations(data))
      .catch((err) =>
        console.error("Fehler beim Laden der Reservationen:", err)
      );
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  return (
    <div>
      <h1>Scanventory</h1>

      <p>
        <strong>Status:</strong> {message}
      </p>

      <ul>
        <li>
          <strong>Benutzer:</strong> {scanState.user || "-"}
        </li>
        <li>
          <strong>Werkzeug:</strong> {scanState.tool || "-"}
        </li>
        <li>
          <strong>Dauer:</strong> {scanState.duration || "-"}{" "}
          {scanState.duration ? "Tage" : ""}
        </li>
        <li>
          <strong>Modus:</strong> {returnMode ? "Rückgabe" : "Ausleihe"}
        </li>
      </ul>

      <ScannerHandler onScan={handleScan} />

      <h2>Aktive Reservationen</h2>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Tool</th>
            <th>Start</th>
            <th>Ende</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((res) => (
            <tr key={res.id}>
              <td>{res.user}</td>
              <td>{res.tool}</td>
              <td>{res.start}</td>
              <td>{res.end}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
