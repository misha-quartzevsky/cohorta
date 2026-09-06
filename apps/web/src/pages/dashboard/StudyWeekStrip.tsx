/**
 * ============================================
 *  StudyWeekStrip.tsx — «Эта неделя», кликабельная и курс-осознанная
 * ============================================
 *
 * Design Sprint, Концепция A (Wednesday Decide + доработка по фидбэку):
 * полный календарь месяца (see history: StudyCalendar.tsx, удалён) занимал
 * на дашборде столько же места, сколько блок «Курсы семестра», при почти
 * всегда пустой сетке — свернули в текущую неделю. Изначальный HTML-мокап
 * подразумевал больше: календарь как учебное расписание — видно, какие
 * курсы обновлялись в какой день, не только факт активности.
 *
 * Теперь под числом дня — до 3 точек цвета курса (те же цвета, что в
 * сайдбаре, через courseAccent), а клик открывает DayDetailPopover с
 * полным разбором: курсы, лекции со ссылками, отдельной строкой колоды.
 */

import { useMemo, useState } from "react";
import { heatmapDayKey } from "../../hooks/useActivityHeatmap";
import type { Lecture } from "../../lib/types";
import { courseColor, lectureCourseId } from "../../lib/types";
import { courseAccent } from "../../lib/courseGradient";
import DayDetailPopover from "./DayDetailPopover";

interface Props {
  /** day key ("YYYY-MM-DD") → число действий в этот день. */
  days: Map<string, number>;
  /** day key → лекции, атрибутированные на этот день. */
  dayLectures: Map<string, Lecture[]>;
  /** day key → число правок колод в этот день. */
  dayDeckCount: Map<string, number>;
  semesterSlug: string;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MAX_DOTS = 3;

/** Понедельник текущей недели, 00:00. */
function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7; // Пн = 0
  date.setDate(date.getDate() - day);
  return date;
}

/** До MAX_DOTS цветов различных курсов, тронутых в этот день (без учёта
 *  лекций без курса — им нечем «светиться» точкой). */
function courseDots(lectures: Lecture[]): string[] {
  const seen = new Set<string>();
  const colors: string[] = [];
  for (const lec of lectures) {
    const courseId = lectureCourseId(lec);
    if (!courseId || seen.has(courseId)) continue;
    const course = lec.expand?.field;
    if (!course) continue;
    seen.add(courseId);
    colors.push(courseAccent(courseColor(course)));
    if (colors.length >= MAX_DOTS) break;
  }
  return colors;
}

export default function StudyWeekStrip({
  days,
  dayLectures,
  dayDeckCount,
  semesterSlug,
}: Props) {
  const todayKey = useMemo(() => heatmapDayKey(new Date()), []);
  const [openDay, setOpenDay] = useState<{ key: string; rect: DOMRect } | null>(
    null
  );

  const week = useMemo(() => {
    const monday = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return { date, key: heatmapDayKey(date) };
    });
  }, []);

  return (
    <div className="widget study-week-strip">
      <div className="widget-head">
        <h3 className="widget-title">Эта неделя</h3>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {week.map(({ date, key }) => {
          const count = days.get(key) ?? 0;
          const isToday = key === todayKey;
          const dots = courseDots(dayLectures.get(key) ?? []);
          const label = date.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
          });
          return (
            <button
              key={key}
              type="button"
              className={
                "calendar-cell" +
                (isToday ? " today" : "") +
                (count > 0 ? " active" : "")
              }
              title={count > 0 ? `${label}: занимались` : label}
              aria-label={label}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setOpenDay((prev) =>
                  prev?.key === key ? null : { key, rect }
                );
              }}
            >
              {count > 0 && <span className="calendar-cell-activity" />}
              <span className="calendar-cell-number">{date.getDate()}</span>
              {dots.length > 0 && (
                <span className="calendar-cell-dots">
                  {dots.map((color, i) => (
                    <span
                      key={i}
                      className="calendar-cell-dot"
                      style={{ background: color }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="calendar-legend">
        <span className="calendar-legend-swatch today" /> Сегодня
        <span className="calendar-legend-swatch activity" /> Была активность
      </div>

      {openDay &&
        (() => {
          const date = week.find((w) => w.key === openDay.key)!.date;
          return (
            <DayDetailPopover
              date={date}
              lectures={dayLectures.get(openDay.key) ?? []}
              deckCount={dayDeckCount.get(openDay.key) ?? 0}
              semesterSlug={semesterSlug}
              anchorRect={openDay.rect}
              onClose={() => setOpenDay(null)}
            />
          );
        })()}
    </div>
  );
}
