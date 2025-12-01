import { useState } from "react";
import "../styles/UserImportModal.css";
import { getToken } from "../utils/authUtils";

import API_URL from "../config/api";

export default function UserImportModal({ onClose }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setImporting(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/api/users/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unbekannter Fehler");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="user-import-overlay" onClick={onClose}>
      <div className="user-import-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Benutzer per CSV importieren</h3>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button
          onClick={handleUpload}
          disabled={!file || importing}
          className="user-import-button"
        >
          {importing ? "Importiere..." : "Import starten"}
        </button>
        {error && <p className="user-import-error">{error}</p>}
        {result && (
          <div className="user-import-result">
            <h4>Import abgeschlossen</h4>
            <p>{result.imported_count} Benutzer importiert</p>
            {result.skipped?.length > 0 && (
              <>
                <h5>Übersprungen</h5>
                <ul>
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      Zeile {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {result.errors?.length > 0 && (
              <>
                <h5>Fehler</h5>
                <ul>
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Zeile {e.row}: {e.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <button className="user-import-close" onClick={onClose}>
          Schliessen
        </button>
      </div>
    </div>
  );
}
