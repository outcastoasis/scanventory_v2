// frontend/src/components/ReservationPopup.jsx
import { useEffect, useState } from "react";
import DatePicker, { registerLocale, setDefaultLocale } from "react-datepicker";
import de from "date-fns/locale/de";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/ReservationPopup.css";


registerLocale("de", de);
setDefaultLocale("de");

const API_URL = (import.meta.env?.VITE_API_URL || "").replace(/\/+$/, "");

export default function ReservationPopup({
  isOpen,
  mode,              // "create" | "edit"
  initialData,       // { reservation?, user?, tool?, start?, end?, note? }
  currentUser,       // { id, username, role }
  onClose,
  onSaved,
}) {
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  // States
  const [user, setUser]   = useState(initialData?.user ?? currentUser ?? null);
  const [tool, setTool]   = useState(initialData?.tool ?? null);
  const [start, setStart] = useState(initialData?.start ? new Date(initialData.start) : new Date());
  const [end, setEnd]     = useState(initialData?.end ? new Date(initialData.end) : new Date(Date.now() + 60 * 60 * 1000));
  const [note, setNote]   = useState(initialData?.note ?? "");

  useEffect(() => { if (isOpen) setError(""); }, [isOpen]);

  const role = currentUser?.role || "guest";
  const isLoggedIn = role !== "guest";

  // Nur Admin/Supervisor dürfen (theoretisch) für andere speichern; bei dir wird aber kein Picker mehr angezeigt.
  const canSubmit =
    role === "admin" ||
    role === "supervisor" ||
    (role === "user" && user && currentUser && String(user.id) === String(currentUser.id));

  const fetchWithAuth = (url, options = {}) => {
    const token = localStorage.getItem("token");
    const headers = { ...(options.headers || {}), "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  if (!isOpen) return null;

  const toIsoUtc = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");

    if (!isLoggedIn) return setError("Bitte zuerst anmelden.");
    if (!user)       return setError("Benutzer fehlt.");
    if (!tool)       return setError("Werkzeug fehlt (per Reservieren-Knopf auswählen).");
    if (!(start < end)) return setError("Endzeit muss nach der Startzeit liegen.");
    if (!canSubmit)  return setError("Keine Berechtigung.");

    setBusy(true);
    try {
      const payload = {
        user_id: user.id,
        tool_id: tool.id ?? undefined,
        tool: tool.qr_code ?? undefined, // Fallback
        start_time: toIsoUtc(start),
        end_time: toIsoUtc(end),
        note: note || "",
      };

      if (mode === "create") {
        const res = await fetchWithAuth(`${API_URL}/api/reservations`, {
          method: "POST", body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Reservation fehlgeschlagen");
        onSaved?.(data);
      } else {
        const id =
          initialData?.reservation?.id ??
          initialData?.id ??
          tool?.reservation_id ??
          null;
        if (!id) throw new Error("Reservation-ID fehlt.");
        const res = await fetchWithAuth(`${API_URL}/api/reservations/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            start_time: payload.start_time,
            end_time: payload.end_time,
            note: payload.note,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Update fehlgeschlagen");
        onSaved?.(data);
      }

      onClose?.();
      window.dispatchEvent(new CustomEvent("scanventory:reservations:refresh"));
    } catch (err) {
      setError(err?.message || "Fehler beim Speichern.");
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = async () => {
    if (mode !== "edit") return;
    if (!tool?.qr_code) {
      setError("Kein Werkzeug-QR gefunden.");
      return;
    }
    setBusy(true);
    try {
      let res = await fetchWithAuth(`${API_URL}/api/reservations/return-tool`, {
        method: "PATCH",
        body: JSON.stringify({ tool: tool.qr_code }),
      });
      if (res.status === 404 || res.status === 405) {
        res = await fetchWithAuth(`${API_URL}/api/reservations/return-tool`, {
          method: "POST",
          body: JSON.stringify({ tool: tool.qr_code }),
        });
      }
      if (!res.ok) throw new Error("Rückgabe fehlgeschlagen");
      onClose?.();
      window.dispatchEvent(new CustomEvent("scanventory:reservations:refresh"));
    } catch (e) {
      setError(e?.message || "Rückgabe nicht möglich.");
    } finally {
      setBusy(false);
    }
  };

  // Labels
const userLabel =
  user?.username ??
  [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  const toolLabel = `${tool?.name ?? ""}${tool?.qr_code ? ` (${tool.qr_code})` : ""}`;

  const disabledSave = busy || !isLoggedIn || !canSubmit || !tool;

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose?.()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === "create" ? "Reservation erstellen" : "Reservation bearbeiten"}</h3>

        {!!error && <div className="alert alert-error">{error}</div>}
        {!isLoggedIn && (
          <div className="alert alert-warning">Bitte anmelden, um zu reservieren.</div>
        )}

        {/* Wer — nur wenn angemeldet */}
        {isLoggedIn && (
          <div className="modal-row">
            <label>Wer:</label>
            <input value={userLabel} disabled />
          </div>
        )}

        {/* Was — immer read-only, kommt vom Reservieren-Knopf */}
        <div className="modal-row">
          <label>Was:</label>
          <input
            value={toolLabel}
            placeholder="Kein Werkzeug ausgewählt"
            disabled
          />
        </div>

        {/* Zeiten */}
        <div className="modal-row">
          <label>Von:</label>
          <DatePicker
            selected={start}
            onChange={(d) => setStart(d)}
            showTimeSelect
            timeIntervals={15}
            timeCaption="Zeit"
            dateFormat="dd.MM.yyyy HH:mm"
            timeFormat="HH:mm"
            locale="de"
            disabled={busy || !canSubmit || !isLoggedIn}
          />
        </div>
        <div className="modal-row">
          <label>Bis:</label>
          <DatePicker
            selected={end}
            onChange={(d) => setEnd(d)}
            showTimeSelect
            timeIntervals={15}
            timeCaption="Zeit"
            dateFormat="dd.MM.yyyy HH:mm"
            timeFormat="HH:mm"
            minDate={start}
            locale="de"
            disabled={busy || !canSubmit || !isLoggedIn}
          />
        </div>

        {/* Notiz */}
        <div className="modal-row">
          <label>Notiz:</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            disabled={busy}
          />
        </div>

        {/* Aktionen */}
        <div className="modal-actions">
          <button onClick={onClose} disabled={busy}>Abbrechen</button>

          {mode === "edit" && (
            <button className="btn-danger" onClick={handleReturn} disabled={busy || !canSubmit}>
              Rückgabe
            </button>
          )}

          <button className="btn-primary" onClick={handleSubmit} disabled={disabledSave}>
            {mode === "create" ? "Speichern" : "Änderungen speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
