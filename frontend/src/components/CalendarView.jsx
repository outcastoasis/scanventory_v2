// frontend/src/components/CalendarViewjsx
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
import ReservationPopup from "./ReservationPopup"; // <— NEU: gemeinsames Popup
import { getToken } from "../utils/authUtils";

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

  // Modal / Edit state (via ReservationPopup)
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupData, setPopupData] = useState(null); // {reservation, user, tool, start, end, note}
  const [currentUser, setCurrentUser] = useState(null);

  // Token → User
  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUser({
          id: decoded.id,
          username: decoded.username,
          role: decoded.role || "guest",
        });
      } catch {
        setCurrentUser({ role: "guest" });
      }
    } else {
      setCurrentUser({ role: "guest" });
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

  // Events aus Reservations
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

  // ---- Öffnen per Event-Klick → EDIT ----
  const openEdit = (event) => {
    const res = event?._res;
    if (!res) return;
    setPopupData({
      reservation: res,
      user: res.user,
      tool: res.tool,
      start: res.start,
      end: res.end,
      note: res.note || "",
    });
    setPopupOpen(true);
  };

  // ---- API-Handlers für Popup ----
  const onSaved = () => {
    setPopupOpen(false);
    setPopupData(null);
    window.dispatchEvent(new CustomEvent("scanventory:reservations:refresh"));
  };

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
    dateFormat: "d",
    weekdayFormat: (date) => format(date, "EEE", { locale: de }),
    monthHeaderFormat: (date) => format(date, "LLLL yyyy", { locale: de }),
    dayHeaderFormat: (date) =>
      format(date, "EEEE, dd. MMMM yyyy", { locale: de }),
    dayRangeHeaderFormat: ({ start, end }) =>
      `${format(start, "dd.MM.yyyy", { locale: de })} – ${format(
        end,
        "dd.MM.yyyy",
        { locale: de }
      )}`,
    dayFormat: (date) => format(date, "EEE dd.MM.", { locale: de }),
    timeGutterFormat: (date) => format(date, "HH:mm", { locale: de }),
    eventTimeRangeFormat: ({ start, end }) =>
      `${format(start, "HH:mm", { locale: de })} – ${format(end, "HH:mm", {
        locale: de,
      })}`,
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
        onSelectEvent={openEdit}
        messages={messagesDe}
        formats={formats}
        eventPropGetter={() => ({ className: "clickable-event" })}
      />

      {popupOpen && (
        <ReservationPopup
          isOpen
          mode="edit"
          initialData={popupData}
          currentUser={currentUser}
          onClose={() => setPopupOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
