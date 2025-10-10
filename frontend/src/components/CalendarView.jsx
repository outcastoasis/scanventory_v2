// frontend/src/components/CalendarView.jsx
import { useMemo, useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  format, parse, startOfWeek, getDay,
  startOfMonth, endOfMonth,
  startOfWeek as dfStartOfWeek, endOfWeek as dfEndOfWeek,
  eachDayOfInterval, isAfter, isBefore, isEqual,
  differenceInCalendarWeeks,
} from "date-fns";
import de from "date-fns/locale/de";

const locales = { de };
const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay, locales,
});

const stripTime = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const minDate = (a, b) => (isBefore(a, b) ? a : b);
const maxDate = (a, b) => (isAfter(a, b) ? a : b);
const lte = (a, b) => isBefore(a, b) || isEqual(a, b);

export default function CalendarView({ reservations }) {
  // gewählte Ansicht persistieren
  const initialView =
    (typeof window !== "undefined" && localStorage.getItem("calendarView")) ||
    "month";

  const [currentView, setCurrentView] = useState(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isNarrow = viewportWidth < 540;
  const isTablet = viewportWidth >= 540 && viewportWidth < 900;

  // Ansicht-Change → speichern
  const handleViewChange = (nextView) => {
    setCurrentView(nextView);
    try {
      localStorage.setItem("calendarView", nextView);
    } catch {}
  };

  const formatTime = (date) => format(new Date(date), "HH:mm", { locale: de });

  const events = useMemo(
    () =>
      (reservations || []).map((res) => {
        const start = new Date(res.start);
        const end = new Date(res.end);
        const title = `${formatTime(start)} – ${formatTime(end)} | ${res.tool} – ${res.user}`;
        return { title, start, end };
      }),
    [reservations]
  );

  // Dynamische Höhe nur für Monatsansicht, passt sich an der Anzahl einträge an
  const dynamicHeight = useMemo(() => {
    if (currentView !== "month") {
      // Fallback-Höhe für den Kalender, wenn nicht die Monatsansicht aktiv ist
      return isNarrow ? 560 : isTablet ? 620 : 680;
    }

    const firstOfMonth = startOfMonth(currentDate);
    const lastOfMonth = endOfMonth(currentDate);
    const visibleStart = stripTime(dfStartOfWeek(firstOfMonth, { weekStartsOn: 1 }));
    const visibleEnd = stripTime(dfEndOfWeek(lastOfMonth, { weekStartsOn: 1 }));
    const weeks =
      differenceInCalendarWeeks(visibleEnd, visibleStart, { weekStartsOn: 1 }) + 1;

    // Events pro Tag zählen
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

  // beim Initial-Load ein Resize triggern → verhindert "+x more"
  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("resize"));
      }
    }, 0);
    return () => clearTimeout(t);
  }, [events, dynamicHeight, currentView]);

  return (
    <div style={{ height: currentView === "month" ? dynamicHeight : "auto" }}>
      <Calendar
        key={`${currentView}-${dynamicHeight}`} // Re-Mount bei View/Höhe
        className={`rbc-scanventory ${currentView === "agenda" ? "is-agenda" : "is-month"}`}
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
        popup={false} // kein "+x more" – wir schaffen Platz
        messages={{
          month: "Monat",
          week: "Woche",
          day: "Tag",
          agenda: "Agenda",
          today: "Heute",
          previous: "Zurück",
          next: "Weiter",
        }}
      />
    </div>
  );
}
