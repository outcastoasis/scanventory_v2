import { useMemo, useState, useEffect, useRef } from "react";
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

const isSameMonth = (left, right) =>
  left instanceof Date &&
  right instanceof Date &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth();

export default function CalendarView({
  reservations,
  autoFollowCurrentMonth = false,
}) {
  const calendarRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 700px)").matches;
  });

  // Persist FullCalendar view keys and migrate old RBC keys.
  const normalizeView = (view) => {
    switch (view) {
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
        return view;
      default:
        return "dayGridMonth";
    }
  };

  const storedView =
    typeof window !== "undefined" ? localStorage.getItem("calendarView") : null;
  const initialView = normalizeView(storedView);

  const [currentView, setCurrentView] = useState(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [popupOpen, setPopupOpen] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 700px)");
    const onChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    }

    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("calendarView", initialView);
    } catch {
      // Ignore localStorage errors (e.g. private mode).
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const title = `${toolLabel} - ${userLabel}`;

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

  const closeMorePopover = () => {
    if (typeof document === "undefined") return;

    const closeButtons = document.querySelectorAll(
      ".svfc-wrap .fc-popover .fc-popover-close, .svfc-wrap .fc-more-popover .fc-popover-close",
    );

    if (closeButtons.length > 0) {
      closeButtons.forEach((button) => {
        button.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
      });
      return;
    }

    const popovers = document.querySelectorAll(
      ".svfc-wrap .fc-popover, .svfc-wrap .fc-more-popover",
    );
    popovers.forEach((popover) => popover.remove());
  };

  const openEditFromEvent = (fcEvent) => {
    const res = fcEvent?.extendedProps?._res;
    if (!res) return;

    closeMorePopover();

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
    setCurrentView(arg.view.type);
    try {
      localStorage.setItem("calendarView", arg.view.type);
    } catch {
      // Ignore localStorage errors (e.g. private mode).
    }
    setCurrentDate(arg.view.currentStart);
  };

  useEffect(() => {
    if (!autoFollowCurrentMonth || currentView !== "dayGridMonth") {
      return undefined;
    }

    const syncCurrentMonth = () => {
      const api = calendarRef.current?.getApi();
      if (!api) return;

      const today = new Date();
      if (isSameMonth(currentDate, today)) return;

      api.gotoDate(today);
    };

    syncCurrentMonth();

    const intervalId = window.setInterval(syncCurrentMonth, 60000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncCurrentMonth();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [autoFollowCurrentMonth, currentDate, currentView]);

  const toolbarConfig = isMobile
    ? {
        left: "prev,next",
        center: "title",
        right: "today dayGridMonth,timeGridDay",
      }
    : {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
      };

  return (
    <div className="svfc-wrap">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={deLocale}
        firstDay={1}
        initialView={currentView}
        initialDate={currentDate}
        timeZone="local"
        events={fcEvents}
        eventClick={(info) => {
          info.jsEvent?.preventDefault?.();
          openEditFromEvent(info.event);
        }}
        datesSet={handleDatesSet}
        headerToolbar={toolbarConfig}
        buttonText={{
          today: "Heute",
          month: "Monat",
          week: "Woche",
          day: "Tag",
          list: "Liste",
        }}
        height="auto"
        expandRows={false}
        dayMaxEvents={isMobile ? 2 : false}
        fixedWeekCount={false}
        showNonCurrentDates={true}
        slotMinTime="05:00:00"
        slotMaxTime="24:00:00"
        slotEventOverlap={false}
        eventMinHeight={18}
        eventShortHeight={18}
        dayHeaderFormat={isMobile ? { weekday: "narrow" } : { weekday: "short" }}
        allDaySlot={false}
        nowIndicator={true}
        eventClassNames={(arg) => {
          const end = arg.event.end;
          const now = new Date();
          return end && end < now ? ["svfc-past"] : [];
        }}
        eventContent={(arg) => {
          const event = arg.event;
          const start = event.start;
          const end = event.end;
          const time = start && end ? `${fmtTime(start)} - ${fmtTime(end)}` : "";
          const fullText = `${time ? `${time} | ` : ""}${event.title}`;

          const now = new Date();
          const isPast = end ? end < now : false;

          return (
            <div className={"svfc-ev" + (isPast ? " is-past" : "")}>
              <span className="svfc-ev-text" title={fullText}>
                {fullText}
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
