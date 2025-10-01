// frontend/src/components/CalendarView.jsx
import { useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { format, parse, startOfWeek, getDay } from "date-fns";
import de from "date-fns/locale/de";

const locales = {
  de: de,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

function CalendarView({ reservations }) {
  const [currentView, setCurrentView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const events = reservations.map((res) => ({
    title: `${res.tool} - ${res.user}`,
    start: new Date(res.start),
    end: new Date(res.end),
  }));

  return (
    <div style={{ height: 600 }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={currentView}
        onView={setCurrentView}
        date={currentDate}
        onNavigate={(date) => setCurrentDate(date)} // ← wichtig!
        defaultView="month"
        views={["month", "week", "day", "agenda"]}
        messages={{
          month: "Monat",
          week: "Woche",
          day: "Tag",
          agenda: "Agenda",
          today: "Heute",
          previous: "Zurück",
          next: "Weiter",
        }}
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "1rem",
        }}
      />
    </div>
  );
}

export default CalendarView;
