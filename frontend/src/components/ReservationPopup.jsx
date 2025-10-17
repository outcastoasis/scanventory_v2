// frontend/src/components/ReservationPopup.jsx
import { useEffect, useState, useMemo } from "react";
import DatePicker, { registerLocale, setDefaultLocale } from "react-datepicker";
import de from "date-fns/locale/de";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/ReservationPopup.css";
import { getToken } from "../utils/authUtils";

registerLocale("de", de);
setDefaultLocale("de");

const API_URL = (import.meta.env?.VITE_API_URL || "").replace(/\/+$/, "");

export default function ReservationPopup({
  isOpen,
  mode, // "create" | "edit"
  initialData, // { reservation?, user?, tool?, start?, end?, note? }
  currentUser, // { id, username, role }
  onClose,
  onSaved,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // States
  const [user, setUser] = useState(initialData?.user ?? currentUser ?? null);
  const [tool, setTool] = useState(initialData?.tool ?? null);
  const [start, setStart] = useState(
    initialData?.start ? new Date(initialData.start) : new Date()
  );
  const [end, setEnd] = useState(
    initialData?.end
      ? new Date(initialData.end)
      : new Date(Date.now() + 60 * 60 * 1000)
  );
  const [note, setNote] = useState(initialData?.note ?? "");

  useEffect(() => {
    if (isOpen) setError("");
  }, [isOpen]);

  const role = currentUser?.role || "guest";
  const isLoggedIn = role !== "guest";

  const fetchWithAuth = (url, options = {}) => {
    const token = getToken();
    const headers = {
      ...(options.headers || {}),
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  // Berechtigungen
  const [permissions, setPermissions] = useState({});
  const isOwnReservation =
    currentUser && user && String(user.id) === String(currentUser.id);

  useEffect(() => {
    if (!currentUser || role === "guest") return;
    fetchWithAuth(`${API_URL}/api/role-permissions/current`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setPermissions(data))
      .catch(() => setPermissions({}));
  }, [currentUser]);

  const canEditReservation = useMemo(() => {
    const perm = permissions?.edit_reservations ?? "false";
    if (perm === "true") return true;
    if (perm === "self_only" && isOwnReservation) return true;
    return false;
  }, [permissions, isOwnReservation]);

  if (!isOpen) return null;

  const toIsoUtc = (d) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");

    if (!isLoggedIn) return setError("Bitte zuerst anmelden.");
    if (!user) return setError("Benutzer fehlt.");
    if (!tool)
      return setError("Werkzeug fehlt (per Reservieren-Knopf auswählen).");
    if (!(start < end))
      return setError("Endzeit muss nach der Startzeit liegen.");
    if (!canEditReservation) return setError("Keine Berechtigung.");

    setBusy(true);
    try {
      const payload = {
        user_id: user.id,
        tool_id: tool.id ?? undefined,
        tool: tool.qr_code ?? undefined, // Fallback
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        note: note || "",
      };

      if (mode === "create") {
        const res = await fetchWithAuth(`${API_URL}/api/reservations`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.error || "Reservation fehlgeschlagen");
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

  const handleDelete = async () => {
    if (!window.confirm("Diese Reservation wirklich löschen?")) return;

    setBusy(true);
    try {
      const id = initialData?.reservation?.id ?? initialData?.id ?? null;
      if (!id) throw new Error("Reservation-ID fehlt.");

      const res = await fetchWithAuth(`${API_URL}/api/reservations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Löschen fehlgeschlagen");

      onClose?.();
      window.dispatchEvent(new CustomEvent("scanventory:reservations:refresh"));
    } catch (err) {
      setError(err?.message || "Fehler beim Löschen.");
    } finally {
      setBusy(false);
    }
  };

  // Labels
  const userLabel =
    user?.username ??
    [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  const toolLabel = `${tool?.name ?? ""}${
    tool?.qr_code ? ` (${tool.qr_code})` : ""
  }`;

  const disabledSave = busy || !isLoggedIn || !canEditReservation || !tool;

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose?.()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {mode === "create"
            ? "Reservation erstellen"
            : "Reservation bearbeiten"}
        </h3>

        {!!error && <div className="alert alert-error">{error}</div>}
        {!isLoggedIn && (
          <div className="alert alert-warning">
            Bitte anmelden, um zu reservieren.
          </div>
        )}

        {isLoggedIn && (
          <div className="modal-row">
            <label>Wer:</label>
            <input value={userLabel} disabled />
          </div>
        )}

        <div className="modal-row">
          <label>Was:</label>
          <input
            value={toolLabel}
            placeholder="Kein Werkzeug ausgewählt"
            disabled
          />
        </div>

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
            disabled={busy || !canEditReservation || !isLoggedIn}
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
            disabled={busy || !canEditReservation || !isLoggedIn}
          />
        </div>

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

        <div className="modal-actions">
          <div className="left-actions">
            <button onClick={onClose} disabled={busy} className="btn-secondary">
              Abbrechen
            </button>
          </div>
          <div className="right-actions">
            {mode === "edit" && canEditReservation && (
              <>
                <button
                  className="btn-danger-outline"
                  onClick={handleDelete}
                  disabled={busy}
                >
                  Löschen
                </button>
                {/* 
                <button
                  className="btn-danger"
                  onClick={handleReturn}
                  disabled={busy}
                >
                  Rückgabe
                </button>
                */}
              </>
            )}
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={disabledSave}
            >
              {mode === "create" ? "Speichern" : "Änderungen speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
