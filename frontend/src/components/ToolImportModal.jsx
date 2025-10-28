import { useState } from "react";
import "../styles/ToolImportModal.css";
import { getToken } from "../utils/authUtils";

const API_URL = import.meta.env.VITE_API_URL;

export default function ToolImportModal({ onClose }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setResult(null);
    setError("");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Bitte eine CSV-Datei auswählen.");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${API_URL}/api/tools/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Import.");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="tool-importmodal-overlay" onClick={onClose}>
      <div
        className="tool-importmodal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Werkzeuge per CSV importieren</h3>

        {!result ? (
          <>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
            >
              {uploading ? "Import läuft..." : "Import starten"}
            </button>
            {error && <p className="tool-importmodal-error {">{error}</p>}
          </>
        ) : (
          <div className="import-result-title">
            <p>✅ {result.imported_count} Werkzeuge erfolgreich importiert.</p>

            {result.skipped?.length > 0 && (
              <>
                <h4>⚠️ Übersprungene Duplikate:</h4>
                <ul>
                  {result.skipped.map((item, idx) => (
                    <li key={idx}>
                      Zeile {item.row}: {item.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {result.errors?.length > 0 && (
              <>
                <h4>❗ Fehlerhafte Zeilen:</h4>
                <ul>
                  {result.errors.map((item, idx) => (
                    <li key={idx}>
                      Zeile {item.row}: {item.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <button onClick={onClose}>Schließen</button>
          </div>
        )}
      </div>
    </div>
  );
}
