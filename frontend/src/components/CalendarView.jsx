// frontend/src/components/CalendarView.jsx
import { useMemo, useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { format, parse, startOfWeek, getDay } from "date-fns";
import de from "date-fns/locale/de";
import { jwtDecode } from "jwt-decode";
import ReservationPopup from "./ReservationPopup";
import { getToken } from "../utils/authUtils";
import CustomMonthView from "./CustomMonthView";
import "../styles/Home.css";

const locales = { de };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

export default function CalendarView({ reservations }) {
  const initialView =
    (typeof window !== "undefined" && localStorage.getItem("calendarView")) ||
    "month";

  const [currentView, setCurrentView] = useState(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [popupOpen, setPopupOpen] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUser({
          id: decoded.user_id || decoded.id,
          username: decoded.username || decoded.sub || "unknown",
          role: decoded.role || "guest",
        });
      } catch {
        setCurrentUser({ role: "guest" });
      }
    } else {
      setCurrentUser({ role: "guest" });
    }
  }, []);

  const handleViewChange = (nextView) => {
    setCurrentView(nextView);
    try {
      localStorage.setItem("calendarView", nextView);
    } catch {}
  };

  const fmtTime = (date) => format(new Date(date), "HH:mm", { locale: de });

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
          end,
        )} | ${toolLabel} – ${userLabel}`;
        return { title, start, end, _res: res };
      }),
    [reservations],
  );

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
    dayFormat: (date) => format(date, "EEE dd.MM.", { locale: de }),
    timeGutterFormat: (date) => format(date, "HH:mm", { locale: de }),
  };

  return (
    <div className="home-calendar">
      <Calendar
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
        views={{
          month: CustomMonthView,
          week: true,
          day: true,
          agenda: true,
        }}
        popup={false}
        selectable={false}
        onSelectEvent={openEdit}
        messages={messagesDe}
        formats={formats}
        eventPropGetter={(event) => {
          const now = new Date();
          const isPast = new Date(event.end) < now;
          return {
            className: "clickable-event" + (isPast ? " past-event" : ""),
          };
        }}
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
