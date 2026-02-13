// frontend/src/components/CalendarView.jsx
import { useMemo, useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import deLocale from "@fullcalendar/core/locales/de";
import { format } from "date-fns";
import de from "date-fns/locale/de";
import { jwtDecode } from "jwt-decode";

import ReservationPopup from "./ReservationPopup";
import { getToken } from "../utils/authUtils";

import "../styles/CalendarViewFC.css";

export default function CalendarView({ reservations }) {
  // View persistieren (FullCalendar View-Keys) + Migration alter RBC-Keys
  const normalizeView = (v) => {
    switch (v) {
      case "month":
        return "dayGridMonth";
      case "week":
        return "timeGridWeek";
      case "day":
        return "timeGridDay";
      case "agenda":
        return "listWeek";
      case "dayGridMonth":
      case "timeGridWeek":
      case "timeGridDay":
      case "listWeek":
        return v;
      default:
        return "dayGridMonth";
    }
  };

  const storedView =
    typeof window !== "undefined" ? localStorage.getItem("calendarView") : null;

  const initialView = normalizeView(storedView);

  const [currentView, setCurrentView] = useState(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Popup/Edit state
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem("calendarView", initialView);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Token → User
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

  const fmtTime = (date) => format(new Date(date), "HH:mm", { locale: de });

  // FullCalendar Events aus Reservations (inkl. _res für Popup)
  const fcEvents = useMemo(() => {
    return (reservations || []).map((res) => {
      const start = new Date(res.start);
      const end = new Date(res.end);

      const userLabel =
        res?.user?.username ||
        [res?.user?.last_name, res?.user?.first_name]
          .filter(Boolean)
          .join(" ") ||
        "";

      const toolLabel = res?.tool?.name || res?.tool || "";

      // Titel ohne Zeit (Zeit rendern wir kontrolliert via eventContent)
      const title = `${toolLabel} – ${userLabel}`;

      return {
        id: String(
          res.id ??
            `${start.toISOString()}-${end.toISOString()}-${toolLabel}-${userLabel}`,
        ),
        title,
        start,
        end,
        extendedProps: { _res: res },
      };
    });
  }, [reservations]);

  const openEditFromEvent = (fcEvent) => {
    const res = fcEvent?.extendedProps?._res;
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

  const handleDatesSet = (arg) => {
    // arg.view.type ist z.B. dayGridMonth, timeGridWeek, timeGridDay, listWeek
    setCurrentView(arg.view.type);
    try {
      localStorage.setItem("calendarView", arg.view.type);
    } catch {}
    // Fokusdatum pflegen
    setCurrentDate(arg.view.currentStart);
  };

  return (
    <div className="svfc-wrap">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={deLocale}
        firstDay={1} // Montag
        initialView={currentView}
        initialDate={currentDate}
        timeZone="local"
        events={fcEvents}
        eventClick={(info) => {
          info.jsEvent?.preventDefault?.();
          openEditFromEvent(info.event);
        }}
        datesSet={handleDatesSet}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
        }}
        buttonText={{
          today: "Heute",
          month: "Monat",
          week: "Woche",
          day: "Tag",
          list: "Liste",
        }}
        // Monatsansicht: Wochenhöhe automatisch nach Inhalt (nicht strecken)
        height="auto"
        expandRows={false}
        // besseres Layout für viele Events
        dayMaxEvents={false}
        fixedWeekCount={false}
        showNonCurrentDates={true}
        // Zeiten im Grid konsistent
        slotMinTime="05:00:00"
        slotMaxTime="24:00:00"
        slotEventOverlap={false}
        eventMinHeight={18}
        eventShortHeight={18}
        dayHeaderFormat={{ weekday: "short" }}
        allDaySlot={false}
        nowIndicator={true}
        eventClassNames={(arg) => {
          const end = arg.event.end;
          const now = new Date();
          return end && end < now ? ["svfc-past"] : [];
        }}
        // Event-Darstellung (wie bisher: "HH:mm – HH:mm | Tool – User")
        eventContent={(arg) => {
          const ev = arg.event;
          const start = ev.start;
          const end = ev.end;

          const time =
            start && end ? `${fmtTime(start)} – ${fmtTime(end)} | ` : "";

          const now = new Date();
          const isPast = end ? end < now : false;

          return (
            <div className={"svfc-ev" + (isPast ? " is-past" : "")}>
              <span className="svfc-ev-text">
                {time}
                {ev.title}
              </span>
            </div>
          );
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
