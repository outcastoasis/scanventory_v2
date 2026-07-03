import { useMemo, useState, useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import deLocale from "@fullcalendar/core/locales/de";
import {
  addDays,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  startOfWeek,
} from "date-fns";
import de from "date-fns/locale/de";
import { jwtDecode } from "jwt-decode";

import CustomWeekView from "./CustomWeekView";
import ReservationPopup from "./ReservationPopup";
import { getToken } from "../utils/authUtils";

import "../styles/CalendarViewFC.css";

const WEEK_START_OPTIONS = { weekStartsOn: 1 };

const VIEW_LABELS = {
  dayGridMonth: "Monat",
  timeGridWeek: "Woche",
  timeGridDay: "Tag",
  listWeek: "Liste",
};

const formatToolbarTitle = (view, date) => {
  const current = date instanceof Date ? date : new Date();

  if (view === "dayGridMonth") {
    return format(current, "MMMM yyyy", { locale: de });
  }

  if (view === "timeGridDay") {
    return format(current, "d. MMMM yyyy", { locale: de });
  }

  const weekStart = startOfWeek(current, WEEK_START_OPTIONS);
  const weekEnd = addDays(weekStart, 6);
  const startPattern =
    weekStart.getFullYear() === weekEnd.getFullYear()
      ? "d. MMMM"
      : "d. MMMM yyyy";

  return `${format(weekStart, startPattern, { locale: de })} - ${format(
    weekEnd,
    "d. MMMM yyyy",
    { locale: de },
  )}`;
};

export default function CalendarView({
  reservations,
  autoFollowCurrentWeek = false,
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
  const initialView = autoFollowCurrentWeek
    ? "timeGridWeek"
    : normalizeView(storedView);

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
    if (autoFollowCurrentWeek) return;

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

  const openEditFromReservation = (res) => {
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

  const openEditFromEvent = (fcEvent) => {
    openEditFromReservation(fcEvent?.extendedProps?._res);
  };

  const onSaved = () => {
    setPopupOpen(false);
    setPopupData(null);
    window.dispatchEvent(new CustomEvent("scanventory:reservations:refresh"));
  };

  const handleDatesSet = (arg) => {
    setCurrentView(arg.view.type);
    if (!autoFollowCurrentWeek) {
      try {
        localStorage.setItem("calendarView", arg.view.type);
      } catch {
        // Ignore localStorage errors (e.g. private mode).
      }
    }
    setCurrentDate(arg.view.currentStart);
  };

  useEffect(() => {
    if (!autoFollowCurrentWeek) {
      return undefined;
    }

    const syncCurrentWeek = () => {
      const today = new Date();
      setCurrentView("timeGridWeek");
      setCurrentDate((previous) =>
        isSameWeek(previous, today, WEEK_START_OPTIONS) ? previous : today,
      );
    };

    syncCurrentWeek();

    const intervalId = window.setInterval(syncCurrentWeek, 60000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncCurrentWeek();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoFollowCurrentWeek]);

  const isWeekView = currentView === "timeGridWeek";

  const persistView = (view) => {
    if (autoFollowCurrentWeek) return;

    try {
      localStorage.setItem("calendarView", view);
    } catch {
      // Ignore localStorage errors (e.g. private mode).
    }
  };

  const changeView = (view) => {
    setCurrentView(view);
    persistView(view);

    if (view !== "timeGridWeek") {
      const api = calendarRef.current?.getApi();
      api?.changeView(view, currentDate);
    }
  };

  const shiftDate = (direction) => {
    if (isWeekView) {
      setCurrentDate((previous) => addDays(previous, direction * 7));
      return;
    }

    const api = calendarRef.current?.getApi();
    if (direction < 0) api?.prev();
    else api?.next();
  };

  const goToday = () => {
    if (isWeekView) {
      setCurrentDate(new Date());
      return;
    }

    calendarRef.current?.getApi()?.today();
  };

  const visibleViews = isMobile
    ? ["dayGridMonth", "timeGridWeek", "timeGridDay"]
    : ["dayGridMonth", "timeGridWeek", "timeGridDay", "listWeek"];
  const today = new Date();
  const isShowingToday =
    currentView === "dayGridMonth"
      ? isSameMonth(currentDate, today)
      : currentView === "timeGridDay"
        ? isSameDay(currentDate, today)
        : isSameWeek(currentDate, today, WEEK_START_OPTIONS);

  return (
    <div className="svfc-wrap">
      <div className="fc svfc-toolbar-only">
        <div className="fc-toolbar fc-header-toolbar">
          <div className="fc-toolbar-chunk">
            <div className="fc-button-group">
              <button
                className="fc-prev-button fc-button fc-button-primary"
                type="button"
                aria-label="Vorherige"
                onClick={() => shiftDate(-1)}
              >
                <span className="fc-icon fc-icon-chevron-left" />
              </button>
              <button
                className="fc-next-button fc-button fc-button-primary"
                type="button"
                aria-label="Nächste"
                onClick={() => shiftDate(1)}
              >
                <span className="fc-icon fc-icon-chevron-right" />
              </button>
            </div>
            <button
              className={
                "fc-today-button fc-button fc-button-primary" +
                (isShowingToday ? " fc-button-disabled" : "")
              }
              type="button"
              disabled={isShowingToday}
              onClick={goToday}
            >
              Heute
            </button>
          </div>

          <div className="fc-toolbar-chunk">
            <h2 className="fc-toolbar-title">
              {formatToolbarTitle(currentView, currentDate)}
            </h2>
          </div>

          <div className="fc-toolbar-chunk">
            <div className="fc-button-group">
              {visibleViews.map((view) => (
                <button
                  className={
                    "fc-button fc-button-primary" +
                    (currentView === view ? " fc-button-active" : "")
                  }
                  type="button"
                  aria-pressed={currentView === view}
                  key={view}
                  onClick={() => changeView(view)}
                >
                  {VIEW_LABELS[view]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isWeekView ? (
        <CustomWeekView
          reservations={reservations}
          weekStart={currentDate}
          onReservationClick={openEditFromReservation}
        />
      ) : (
        <FullCalendar
          key={currentView}
          ref={calendarRef}
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            listPlugin,
            interactionPlugin,
          ]}
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
          headerToolbar={false}
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
          dayHeaderFormat={
            isMobile ? { weekday: "narrow" } : { weekday: "short" }
          }
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
            const time =
              start && end ? `${fmtTime(start)} - ${fmtTime(end)}` : "";
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
      )}

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
