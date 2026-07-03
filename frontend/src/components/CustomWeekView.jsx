import { useMemo } from "react";
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from "date-fns";
import de from "date-fns/locale/de";

import "../styles/CustomWeekView.css";

const WEEK_START_OPTIONS = { weekStartsOn: 1 };

const toLocalDate = (value) => new Date(String(value).replace(" ", "T"));

const getToolLabel = (reservation) =>
  reservation?.tool?.name ||
  reservation?.tool?.qr_code ||
  reservation?.tool ||
  "Unbekannt";

const getUserLabel = (reservation) => {
  const user = reservation?.user;
  if (!user) return "Unbekannt";

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return name || user.username || "Unbekannt";
};

const getReservationId = (reservation) =>
  reservation?.id ??
  `${reservation?.start || ""}-${reservation?.end || ""}-${getToolLabel(
    reservation,
  )}`;

const formatTimeRange = (start, end) => {
  if (isSameDay(start, end)) {
    return `${format(start, "HH:mm", { locale: de })} - ${format(end, "HH:mm", {
      locale: de,
    })}`;
  }

  return `${format(start, "dd.MM. HH:mm", { locale: de })} - ${format(
    end,
    "dd.MM. HH:mm",
    { locale: de },
  )}`;
};

const getState = (start, end, now) => {
  if (end < now) return "past";
  if (start <= now && end >= now) return "current";
  return "upcoming";
};

const isFree = (rows, rowIndex, startIndex, endIndex) => {
  const row = rows[rowIndex] || [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    if (row[index]) return false;
  }

  return true;
};

const markBusy = (rows, rowIndex, startIndex, endIndex) => {
  rows[rowIndex] ||= [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    rows[rowIndex][index] = true;
  }
};

const statePriority = {
  current: 0,
  upcoming: 1,
  past: 2,
};

function layoutReservations(reservations, weekStart, weekEnd, now) {
  const rows = [];

  return (reservations || [])
    .map((reservation) => {
      const start = toLocalDate(reservation.start);
      const end = toLocalDate(reservation.end);

      return {
        reservation,
        start,
        end,
        rawStartIndex: differenceInCalendarDays(startOfDay(start), weekStart),
        rawEndIndex: differenceInCalendarDays(startOfDay(end), weekStart),
      };
    })
    .filter((item) => item.start < weekEnd && item.end >= weekStart)
    .map((item) => ({
      ...item,
      continuesBefore: item.start < weekStart,
      continuesAfter: item.end > endOfDay(addDays(weekStart, 6)),
      startIndex: Math.max(0, item.rawStartIndex),
      endIndex: Math.min(6, item.rawEndIndex),
      state: getState(item.start, item.end, now),
      toolLabel: getToolLabel(item.reservation),
      userLabel: getUserLabel(item.reservation),
    }))
    .sort((a, b) => {
      const stateDelta = statePriority[a.state] - statePriority[b.state];
      if (stateDelta !== 0) return stateDelta;

      const spanDelta = b.endIndex - b.startIndex - (a.endIndex - a.startIndex);
      if (spanDelta !== 0) return spanDelta;

      const startDelta = a.start - b.start;
      if (startDelta !== 0) return startDelta;

      return a.toolLabel.localeCompare(b.toolLabel, "de");
    })
    .map((item) => {
      let rowIndex = 0;

      while (!isFree(rows, rowIndex, item.startIndex, item.endIndex)) {
        rowIndex += 1;
      }

      markBusy(rows, rowIndex, item.startIndex, item.endIndex);

      return { ...item, rowIndex };
    });
}

export default function CustomWeekView({
  reservations,
  weekStart,
  onReservationClick,
}) {
  const now = new Date();
  const normalizedWeekStart = useMemo(
    () => startOfWeek(weekStart || new Date(), WEEK_START_OPTIONS),
    [weekStart],
  );
  const weekEnd = useMemo(
    () => addDays(normalizedWeekStart, 7),
    [normalizedWeekStart],
  );
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(normalizedWeekStart, index);
        return {
          date,
          short: format(date, "EE", { locale: de }),
          number: format(date, "d", { locale: de }),
          isCurrentDay: isToday(date),
        };
      }),
    [normalizedWeekStart],
  );

  const laidOutReservations = useMemo(
    () => layoutReservations(reservations, normalizedWeekStart, weekEnd, now),
    [reservations, normalizedWeekStart, weekEnd, now],
  );
  const rowCount = Math.max(
    1,
    ...laidOutReservations.map((item) => item.rowIndex + 1),
  );
  const minBodyHeight = Math.max(98, 34 + rowCount * 38);

  return (
    <section className="svcw-shell" aria-label="Custom Wochenansicht">
      <div className="svcw-grid">
        {days.map((day) => (
          <div
            className={"svcw-day-name" + (day.isCurrentDay ? " is-today" : "")}
            key={`head-${day.date.toISOString()}`}
          >
            {day.short}
          </div>
        ))}

        <div
          className="svcw-body"
          style={{
            "--event-rows": rowCount,
            minHeight: `${minBodyHeight}px`,
          }}
        >
          {days.map((day, index) => (
            <div
              className={"svcw-day-bg" + (day.isCurrentDay ? " is-today" : "")}
              key={`bg-${day.date.toISOString()}`}
              style={{ gridColumn: index + 1 }}
            />
          ))}

          {days.map((day, index) => (
            <span
              className={
                "svcw-day-number" + (day.isCurrentDay ? " is-today" : "")
              }
              key={`number-${day.date.toISOString()}`}
              style={{ gridColumn: index + 1, gridRow: 1 }}
            >
              {day.number}
            </span>
          ))}

          {laidOutReservations.map((item) => {
            const isMultiDay = item.startIndex !== item.endIndex;
            const hasLeftContinuation = item.continuesBefore;
            const hasRightContinuation = item.continuesAfter;
            const timeLabel = formatTimeRange(item.start, item.end);
            const fullLabel = `${hasLeftContinuation ? "weiter von vorheriger Woche " : ""}${timeLabel} ${item.toolLabel} ${item.userLabel}${hasRightContinuation ? " weiter in nächste Woche" : ""}`;

            return (
              <button
                className={[
                  "svcw-event",
                  `is-${item.state}`,
                  isMultiDay ? "is-multi" : "",
                  hasLeftContinuation ? "continues-before" : "",
                  hasRightContinuation ? "continues-after" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={getReservationId(item.reservation)}
                type="button"
                aria-label={fullLabel}
                style={{
                  gridColumn: `${item.startIndex + 1} / ${item.endIndex + 2}`,
                  gridRow: item.rowIndex + 2,
                }}
                onClick={() => onReservationClick?.(item.reservation)}
              >
                <span className="svcw-event-meta">
                  {hasLeftContinuation && (
                    <span className="svcw-continuation">&larr;</span>
                  )}
                  <span className="svcw-time-badge">{timeLabel}</span>
                  {hasRightContinuation && (
                    <span className="svcw-continuation is-after">&rarr;</span>
                  )}
                </span>
                <span className="svcw-event-title">{item.toolLabel}</span>
                <span className="svcw-event-user">{item.userLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
