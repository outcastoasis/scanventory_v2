import { useMemo, useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  startOfWeek as dfStartOfWeek,
  endOfWeek as dfEndOfWeek,
  eachDayOfInterval,
  isAfter,
  isBefore,
  isEqual,
  differenceInCalendarWeeks,
} from "date-fns";
import de from "date-fns/locale/de";
import { jwtDecode } from "jwt-decode";
import DatePicker, { registerLocale, setDefaultLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("de", de);
setDefaultLocale("de"); // macht "de" global für alle DatePicker

const locales = { de };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const stripTime = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const minDate = (a, b) => (isBefore(a, b) ? a : b);
const maxDate = (a, b) => (isAfter(a, b) ? a : b);
const lte = (a, b) => isBefore(a, b) || isEqual(a, b);

const API_URL = (import.meta.env?.VITE_API_URL || "").replace(/\/+$/, "");

export default function CalendarView({ reservations }) {
  const initialView =
    (typeof window !== "undefined" && localStorage.getItem("calendarView")) ||
    "month";

  const [currentView, setCurrentView] = useState(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  // Modal / Edit state
  const [selectedRes, setSelectedRes] = useState(null);
  const [editDraft, setEditDraft] = useState(null); // { start_time, end_time, note }
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("guest");
  const [username, setUsername] = useState(null);

  // Token auslesen (für Rechte)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setRole(decoded.role || "guest");
        setUsername(decoded.username || null);
      } catch {
        setRole("guest");
        setUsername(null);
      }
    } else {
      setRole("guest");
      setUsername(null);
    }
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isNarrow = viewportWidth < 540;
  const isTablet = viewportWidth >= 540 && viewportWidth < 900;

  const handleViewChange = (nextView) => {
    setCurrentView(nextView);
    try {
      localStorage.setItem("calendarView", nextView);
    } catch {}
  };

  const fmtTime = (date) => format(new Date(date), "HH:mm", { locale: de });

  // Erwartetes Reservation-Format siehe Backend
  const events = useMemo(
    () =>
      (reservations || []).map((res) => {
        const start = new Date(res.start);
        const end = new Date(res.end);
        const userLabel =
          res?.user?.username ||
          [res?.user?.last_name, res?.user?.first_name]
            .filter(Boolean)
            .join(" ") ||
          "";
        const toolLabel = res?.tool?.name || res?.tool || "";
        const title = `${fmtTime(start)} – ${fmtTime(
          end
        )} | ${toolLabel} – ${userLabel}`;
        return { title, start, end, _res: res };
      }),
    [reservations]
  );

  // Dynamische Höhe (Monat)
  const dynamicHeight = useMemo(() => {
    if (currentView !== "month") {
      return isNarrow ? 560 : isTablet ? 620 : 680;
    }
    const firstOfMonth = startOfMonth(currentDate);
    const lastOfMonth = endOfMonth(currentDate);
    const visibleStart = stripTime(
      dfStartOfWeek(firstOfMonth, { weekStartsOn: 1 })
    );
    const visibleEnd = stripTime(dfEndOfWeek(lastOfMonth, { weekStartsOn: 1 }));
    const weeks =
      differenceInCalendarWeeks(visibleEnd, visibleStart, { weekStartsOn: 1 }) +
      1;

    const counts = new Map();
    for (const ev of events) {
      let s = stripTime(ev.start);
      let e = stripTime(ev.end);
      if (isBefore(e, s)) e = s;
      s = maxDate(s, visibleStart);
      e = minDate(e, visibleEnd);
      if (lte(s, e)) {
        for (const d of eachDayOfInterval({ start: s, end: e })) {
          const key = format(d, "yyyy-MM-dd");
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    }

    const maxPerDay = Math.max(1, 0, ...counts.values());
    const HEADER = isNarrow ? 80 : isTablet ? 88 : 96;
    const ROW_BASE = isNarrow ? 44 : isTablet ? 48 : 54;
    const EVENT_LINE = isNarrow ? 16 : isTablet ? 17 : 18;
    const SAFETY = isNarrow ? 24 : 28;

    return HEADER + (ROW_BASE + EVENT_LINE * maxPerDay) * weeks + SAFETY;
  }, [currentDate, events, currentView, isNarrow, isTablet]);

  // "+x more" vermeiden
  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("resize"));
      }
    }, 0);
    return () => clearTimeout(t);
  }, [events, dynamicHeight, currentView]);

  // ---- Berechtigungen (Frontend-Check; Backend prüft nochmals) ----
  const canEdit = (res) => {
    if (!res || !res.user) return false;
    if (role === "admin" || role === "supervisor") return true;
    if (role === "user") {
      if (!username) return false;
      return (
        res.user.username &&
        res.user.username.toLowerCase() === username.toLowerCase()
      );
    }
    return false;
  };
  const canReturn = (res) => canEdit(res);

  // ---- Fetch helper ----
  const fetchWithAuth = (url, options = {}) => {
    const token = localStorage.getItem("token");
    const headers = {
      ...(options.headers || {}),
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  // ---- Modal ----
  const openModal = (event) => {
    const res = event?._res;
    if (!res) return;
    setSelectedRes(res);
    setEditDraft({
      start_time: toIsoUtcFromLocal(res.start),
      end_time: toIsoUtcFromLocal(res.end),
      note: res.note || "",
    });
  };
  const closeModal = () => {
    if (busy) return;
    setSelectedRes(null);
    setEditDraft(null);
  };

  // ---- Save ----
  const saveReservation = async () => {
    if (!selectedRes || !canEdit(selectedRes)) return;
    setBusy(true);
    try {
      const res = await fetchWithAuth(
        `${API_URL}/api/reservations/${selectedRes.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            start_time: editDraft.start_time,
            end_time: editDraft.end_time,
            note: editDraft.note || "",
          }),
        }
      );
      if (!res.ok) throw new Error("Update fehlgeschlagen");
      const updated = await res.json();
      setSelectedRes(
        (prev) =>
          prev && {
            ...prev,
            start: fromIsoUtcToLocal(updated.start_time),
            end: fromIsoUtcToLocal(updated.end_time),
            note: updated.note || "",
          }
      );
      closeModal();
      window.dispatchEvent(new CustomEvent("scanventory:reservations:refresh"));
    } catch {
      alert("❌ Konnte Reservation nicht speichern");
    } finally {
      setBusy(false);
    }
  };

  // ---- Return (Rückgabe) – robust mit Fallbacks ----
  const returnReservation = async () => {
    if (!selectedRes || !canReturn(selectedRes)) return;
    const toolQr = selectedRes?.tool?.qr_code;
    if (!toolQr) {
      alert("Kein Werkzeug-QR gefunden.");
      return;
    }
    setBusy(true);
    const body = JSON.stringify({ tool: toolQr });
    try {
      // 1) PATCH /return-tool
      let res = await fetchWithAuth(`${API_URL}/api/reservations/return-tool`, {
        method: "PATCH",
        body,
      });

      // 2) Fallback: POST /return-tool (falls PATCH 404/405)
      if (res.status === 404 || res.status === 405) {
        res = await fetchWithAuth(`${API_URL}/api/reservations/return-tool`, {
          method: "POST",
          body,
        });
      }

      // 3) Fallback: Alias /return_tool
      if (!res.ok) {
        res = await fetchWithAuth(`${API_URL}/api/reservations/return_tool`, {
          method: "POST",
          body,
        });
      }

      if (!res.ok) throw new Error("Rückgabe fehlgeschlagen");

      closeModal();
      window.dispatchEvent(new CustomEvent("scanventory:reservations:refresh"));
    } catch {
      alert("❌ Rückgabe nicht möglich");
    } finally {
      setBusy(false);
    }
  };

  // Optional: Parent lauscht und lädt neu
  useEffect(() => {
    const handler = () => {};
    window.addEventListener("scanventory:reservations:refresh", handler);
    return () =>
      window.removeEventListener("scanventory:reservations:refresh", handler);
  }, []);

  // ====== UI-Permissions für Buttons (immer sichtbar, ggf. disabled + Tooltip) ======
  const canEditSelected = selectedRes ? canEdit(selectedRes) : false;
  const canReturnSelected = selectedRes ? canReturn(selectedRes) : false;
  const denyText = "keine Berechtigung";

  const messagesDe = {
    month: "Monat",
    week: "Woche",
    day: "Tag",
    agenda: "Agenda",
    today: "Heute",
    previous: "Zurück",
    next: "Weiter",
    allDay: "Ganztägig",
    noEventsInRange: "Keine Ereignisse in diesem Zeitraum",
    showMore: (total) => `+${total} mehr`,
  };

  const formats = {
    // Kleine Datumskästchen im Monat
    dateFormat: "d",

    // Kopfzeilen & Wochentage
    weekdayFormat: (date) => format(date, "EEE", { locale: de }), // Mo, Di, …
    monthHeaderFormat: (date) => format(date, "LLLL yyyy", { locale: de }), // Oktober 2025
    dayHeaderFormat: (date) =>
      format(date, "EEEE, dd. MMMM yyyy", { locale: de }),
    dayRangeHeaderFormat: ({ start, end }) =>
      `${format(start, "dd.MM.yyyy", { locale: de })} – ${format(
        end,
        "dd.MM.yyyy",
        { locale: de }
      )}`,

    // Monat/Zelle: Datum + Kurz-Tag
    dayFormat: (date) => format(date, "EEE dd.MM.", { locale: de }),

    // Zeiten (24h, kein AM/PM)
    timeGutterFormat: (date) => format(date, "HH:mm", { locale: de }),
    eventTimeRangeFormat: ({ start, end }) =>
      `${format(start, "HH:mm", { locale: de })} – ${format(end, "HH:mm", {
        locale: de,
      })}`,

    // Agenda-Ansicht
    agendaHeaderFormat: ({ start, end }) =>
      `${format(start, "dd.MM.yyyy", { locale: de })} – ${format(
        end,
        "dd.MM.yyyy",
        { locale: de }
      )}`,
    agendaDateFormat: (date) => format(date, "dd.MM.yyyy", { locale: de }),
    agendaTimeRangeFormat: ({ start, end }) =>
      `${format(start, "HH:mm", { locale: de })} – ${format(end, "HH:mm", {
        locale: de,
      })}`,
  };

  return (
    <div style={{ height: currentView === "month" ? dynamicHeight : "auto" }}>
      <Calendar
        key={`${currentView}-${dynamicHeight}`}
        className={`rbc-scanventory ${
          currentView === "agenda" ? "is-agenda" : "is-month"
        }`}
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={currentView}
        onView={handleViewChange}
        date={currentDate}
        onNavigate={(date) => setCurrentDate(date)}
        defaultView="month"
        views={["month", "week", "day", "agenda"]}
        popup={false}
        selectable={false}
        onSelectEvent={openModal}
        messages={messagesDe} // <— neu
        formats={formats} // <— neu (24h & deutsche Ausgabe)
        eventPropGetter={() => ({ className: "clickable-event" })}
      />

      {selectedRes && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reservation</h3>

            <div className="modal-row">
              <strong>Wer:</strong>
              <div>
                {(() => {
                  const u = selectedRes?.user || {};
                  const parts = [u.first_name, u.last_name]
                    .map((v) => (typeof v === "string" ? v.trim() : v))
                    .filter(Boolean);
                  return parts.join(" ") || "–";
                })()}
              </div>
            </div>

            <div className="modal-row">
              <strong>Was:</strong>
              <div>
                {selectedRes?.tool?.name}
                {selectedRes?.tool?.qr_code
                  ? ` (${selectedRes.tool.qr_code})`
                  : ""}
              </div>
            </div>

            {/* === Von === */}
            <div className="modal-row">
              <label>Von:</label>
              <DatePicker
                selected={fromIsoUtcToLocal(editDraft?.start_time)}
                onChange={(date) =>
                  setEditDraft({
                    ...editDraft,
                    start_time: toIsoUtcFromLocal(date),
                  })
                }
                showTimeSelect
                timeIntervals={15}
                timeCaption="Zeit"
                dateFormat="dd.MM.yyyy HH:mm"
                timeFormat="HH:mm" // 24h im Zeit-Dropdown, kein AM/PM
                locale="de" // deutsche Labels
                disabled={!canEditSelected || busy}
                minTime={new Date(0, 0, 0, 0, 0)}
                maxTime={new Date(0, 0, 0, 23, 45)}
              />
            </div>

            {/* === Bis === */}
            <div className="modal-row">
              <label>Bis:</label>
              <DatePicker
                selected={fromIsoUtcToLocal(editDraft?.end_time)}
                onChange={(date) =>
                  setEditDraft({
                    ...editDraft,
                    end_time: toIsoUtcFromLocal(date),
                  })
                }
                showTimeSelect
                timeIntervals={15}
                timeCaption="Zeit"
                dateFormat="dd.MM.yyyy HH:mm"
                timeFormat="HH:mm" // 24h
                locale="de" // deutsch
                disabled={!canEditSelected || busy}
                minTime={new Date(0, 0, 0, 0, 0)}
                maxTime={new Date(0, 0, 0, 23, 45)}
              />
            </div>

            <div className="modal-row">
              <label>Notiz:</label>
              <input
                type="text"
                value={editDraft?.note || ""}
                onChange={(e) =>
                  setEditDraft({ ...editDraft, note: e.target.value })
                }
                placeholder="Optional"
                disabled={!canEditSelected || busy}
              />
            </div>

            <div className="modal-actions">
              <button onClick={closeModal} disabled={busy}>
                Schliessen
              </button>

              {/* Rückgabe: immer zeigen, ggf. disabled + Tooltip über <span> */}
              <span title={!canReturnSelected ? denyText : undefined}>
                <button
                  className={`btn-danger ${
                    !canReturnSelected ? "is-disabled" : ""
                  }`}
                  onClick={returnReservation}
                  disabled={busy || !canReturnSelected}
                  aria-disabled={!canReturnSelected}
                >
                  Rückgabe
                </button>
              </span>

              {/* Speichern: immer zeigen, ggf. disabled + Tooltip über <span> */}
              <span title={!canEditSelected ? denyText : undefined}>
                <button
                  className={`btn-primary ${
                    !canEditSelected ? "is-disabled" : ""
                  }`}
                  onClick={saveReservation}
                  disabled={busy || !canEditSelected}
                  aria-disabled={!canEditSelected}
                >
                  Speichern
                </button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==== 15-Minuten-Snap ==== */
function snapToQuarterHour(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  const snapped = Math.round(m / 15) * 15; // nächste Viertelstunde
  d.setMinutes(snapped);
  return d;
}

/* ==== Zeit-Helper ==== */
function toLocalInput(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
function toIsoUtcFromLocal(localStrOrDate) {
  if (!localStrOrDate) return null;
  const d = new Date(localStrOrDate);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}
function fromIsoUtcToLocal(isoUtc) {
  if (!isoUtc) return null;
  return new Date(isoUtc);
}

/* ==== Local <-> ISO UTC Helpers für getrennte Date/Time-Inputs ==== */
function toLocalDateInput(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getLocalHour(dateLike) {
  if (!dateLike) return "00";
  const d = new Date(dateLike);
  return String(d.getHours()).padStart(2, "0");
}
function getLocalQuarterMinute(dateLike) {
  if (!dateLike) return "00";
  const d = new Date(dateLike);
  const m = d.getMinutes();
  const quarters = [0, 15, 30, 45];
  // auf nächstliegende Viertelminute mappen (falls alte Daten falsch sind)
  const nearest = quarters.reduce(
    (a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a),
    0
  );
  return String(nearest).padStart(2, "0");
}
/** Baut aus lokalem Datum (YYYY-MM-DD), Stunde ("00"-"23") und Minute ("00","15","30","45") ein ISO-UTC */
function composeIsoUtcFromLocal(dateStr, hourStr, minuteStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const hh = parseInt(hourStr || "0", 10);
  const mm = parseInt(minuteStr || "0", 10);
  const local = new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0); // lokale Zeit
  // nach UTC-ISO konvertieren
  return new Date(
    local.getTime() - local.getTimezoneOffset() * 60000
  ).toISOString();
}
