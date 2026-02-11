// frontend/src/components/CustomMonthView.jsx
import React, { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  format as dfFormat,
  eachDayOfInterval,
  differenceInCalendarDays,
  max as dfMax,
  min as dfMin,
} from "date-fns";
import de from "date-fns/locale/de";
import "../styles/Test.css";

const stripTime = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function getMonthRange(date) {
  const first = startOfMonth(date);
  const last = endOfMonth(date);
  const start = startOfWeek(first, { weekStartsOn: 1 });
  const end = endOfWeek(last, { weekStartsOn: 1 });
  return { start, end };
}

function buildWeeks(date) {
  const { start, end } = getMonthRange(date);
  const weeks = [];
  let cur = start;

  while (cur <= end) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(cur);
      cur = addDays(cur, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function isMultiDay(ev) {
  const s = stripTime(new Date(ev.start));
  const e = stripTime(new Date(ev.end));
  return differenceInCalendarDays(e, s) >= 1;
}

function eventIntersectsDay(ev, day) {
  const d = stripTime(day);
  const s = stripTime(new Date(ev.start));
  const e = stripTime(new Date(ev.end));
  return d >= s && d <= e;
}

function clampEventToWeek(ev, weekStart, weekEnd) {
  const s = stripTime(new Date(ev.start));
  const e = stripTime(new Date(ev.end));
  const cs = dfMax([s, weekStart]);
  const ce = dfMin([e, weekEnd]);
  return { cs, ce };
}

function dayIndexInWeek(day, weekStart) {
  return differenceInCalendarDays(stripTime(day), stripTime(weekStart)); // 0..6
}

function buildWeekSegments(weekDays, events) {
  const weekStart = stripTime(weekDays[0]);
  const weekEnd = stripTime(weekDays[6]);

  // nur Multi-Day, die diese Woche schneiden
  const segs = events
    .filter((ev) => isMultiDay(ev))
    .map((ev) => {
      const { cs, ce } = clampEventToWeek(ev, weekStart, weekEnd);
      if (cs > ce) return null;
      const startCol = dayIndexInWeek(cs, weekStart); // 0..6
      const endCol = dayIndexInWeek(ce, weekStart); // 0..6
      return { ev, startCol, endCol };
    })
    .filter(Boolean)
    // sort: früher start, dann länger zuerst
    .sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol);

  // Lanes (Zeilen) ohne Overlaps vergeben
  const lanes = []; // jedes lane: array von segments
  for (const seg of segs) {
    let placed = false;
    for (const lane of lanes) {
      const overlap = lane.some(
        (x) => !(seg.endCol < x.startCol || seg.startCol > x.endCol),
      );
      if (!overlap) {
        lane.push(seg);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([seg]);
  }

  return { lanes, laneCount: lanes.length };
}

function CustomMonthView(props) {
  const { date, events, onSelectEvent } = props;

  const weeks = useMemo(() => buildWeeks(date), [date]);

  // Höhenparameter
  const WEEK_MIN = 92;
  const WEEK_BASE = 92;
  const EVENT_LINE = 18;
  const WEEK_PAD = 10;
  const MAX_WEEK_HEIGHT = 260;

  const weekMeta = useMemo(() => {
    return weeks.map((weekDays) => {
      // Multi-Day Bars (Lanes)
      const { lanes, laneCount } = buildWeekSegments(weekDays, events);

      // Singles pro Tag (ohne Multi-Day)
      let maxSinglesPerDay = 0;
      for (const day of weekDays) {
        const cnt = events.reduce((acc, ev) => {
          if (isMultiDay(ev)) return acc;
          return acc + (eventIntersectsDay(ev, day) ? 1 : 0);
        }, 0);
        if (cnt > maxSinglesPerDay) maxSinglesPerDay = cnt;
      }

      // Höhe: Platz für Bar-Lanes + Platz für Singles
      const any = laneCount > 0 || maxSinglesPerDay > 0;
      const h = !any
        ? WEEK_MIN
        : WEEK_BASE + EVENT_LINE * (laneCount + maxSinglesPerDay) + WEEK_PAD;

      return {
        lanes,
        laneCount,
        height: Math.min(MAX_WEEK_HEIGHT, h),
      };
    });
  }, [weeks, events]);

  return (
    <div className="sv-month">
      <div className="sv-month-header">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <div key={d} className="sv-month-header-cell">
            {d}
          </div>
        ))}
      </div>

      <div className="sv-month-weeks">
        {weeks.map((weekDays, wi) => {
          const meta = weekMeta[wi];
          return (
            <div
              key={wi}
              className="sv-week-wrap"
              style={{
                height: meta.height,
                ["--laneCount"]: meta.laneCount, // CSS-Var fuer Padding/Overlayhoehe
              }}
            >
              {/* Days Grid (Basis) */}
              <div className="sv-week-days">
                {weekDays.map((day) => {
                  const inMonth = isSameMonth(day, date);

                  const dayEvents = events
                    .filter(
                      (ev) => !isMultiDay(ev) && eventIntersectsDay(ev, day),
                    )
                    .sort((a, b) => new Date(a.start) - new Date(b.start));

                  return (
                    <div
                      key={day.toISOString()}
                      className={"sv-day" + (inMonth ? "" : " is-out")}
                    >
                      <div className="sv-day-number">
                        {dfFormat(day, "d", { locale: de })}
                      </div>

                      <div className="sv-day-events">
                        {dayEvents.map((ev, idx) => (
                          <button
                            type="button"
                            key={`${ev.start}-${ev.end}-${idx}`}
                            className="sv-ev"
                            onClick={() => onSelectEvent?.(ev)}
                            title={ev.title}
                          >
                            {ev.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Multi-Day Bars Overlay (liegt IN den Day-Cells) */}
              {meta.laneCount > 0 && (
                <div
                  className="sv-week-bars"
                  style={{
                    gridTemplateRows: `repeat(${meta.laneCount}, 18px)`,
                  }}
                >
                  {meta.lanes.flatMap((lane, li) =>
                    lane.map((seg, si) => (
                      <button
                        key={`${li}-${si}-${seg.ev.start}-${seg.ev.end}`}
                        type="button"
                        className="sv-bar"
                        style={{
                          gridRow: li + 1,
                          gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                        }}
                        onClick={() => onSelectEvent?.(seg.ev)}
                        title={seg.ev.title}
                      >
                        {seg.ev.title}
                      </button>
                    )),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* react-big-calendar view hooks */
CustomMonthView.range = (date) => {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
};

CustomMonthView.navigate = (date, action) => {
  switch (action) {
    case "PREV":
      return addMonths(date, -1);
    case "NEXT":
      return addMonths(date, 1);
    default:
      return date;
  }
};

CustomMonthView.title = (date, { localizer }) => {
  return localizer.format(date, "monthHeaderFormat");
};

export default CustomMonthView;
