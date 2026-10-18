import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useSemester } from "../lib/semesterContext";
import { useSchedule } from "../hooks/useSchedule";
import { useTasks } from "../hooks/useTasks";
import { useLastVisited } from "../hooks/useLastVisited";
import { useUpcomingExam, useExam } from "../hooks/useExam";
import { useActivityHeatmap, heatmapDayKey } from "../hooks/useActivityHeatmap";
import { useDecks } from "../hooks/useDecks";
import {
  fetchScheduledLectures,
  fetchLecturesOfSubject,
  startNoteForSlot,
} from "../services/scheduleService";
import { fetchCourses } from "../services/courseService";
import type { Course, Lecture, ScheduleSlot } from "../lib/types";
import {
  courseName,
  courseSlug,
  semesterSlug,
  examCourseId,
  examTitle,
  examDaysLeft,
  ticketStatus,
  deckTitle,
  deckSlug,
} from "../lib/types";
import { pickActiveSemester } from "../lib/activeSemester";
import { todayStr, fromDateStr, mondayOf, weekdayMon1 } from "../lib/localDate";
import { getWeekParity, slotMatchesParity, findLectureForOccurrence } from "../lib/weekParity";
import { isOpen } from "../lib/taskView";
import { userName, pluralRu, timeAgo } from "../lib/format";
import Header from "../components/Header";
import SemesterGate from "../components/SemesterGate";
import LoadingState from "../components/LoadingState";
import { Button, Icon, SubjectCover, StatusChip } from "../ui";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function kindLabel(slot: ScheduleSlot): string {
  if (slot.kind === "seminar") return "Семинар";
  if (slot.kind === "lab") return "Лаб.";
  if (slot.kind === "other") return "Пара";
  return "Лекция";
}

function pairTime(settings: { pair_times?: { n: number; start: string }[] } | null, n: number): string {
  return settings?.pair_times?.find((p) => p.n === n)?.start ?? "";
}

function greetingDate(): string {
  const s = new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function startOfWeekMon(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date;
}

export default function DashboardNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, semesters, error: semError } = useSemester();
  const activeSemester = useMemo(() => current ?? pickActiveSemester(semesters), [current, semesters]);
  const semId = activeSemester?.id;
  const semSlug = activeSemester ? semesterSlug(activeSemester) : "";

  const { settings, slots } = useSchedule(semId);
  const { tasks, setDone } = useTasks();
  const lastVisited = useLastVisited();
  const { exam: upcomingExam } = useUpcomingExam();
  const { tickets: upcomingTickets } = useExam(
    upcomingExam ? examCourseId(upcomingExam) : "",
    !!upcomingExam
  );
  const heatmap = useActivityHeatmap();
  const { decks } = useDecks(3);

  const [courses, setCourses] = useState<Course[]>([]);
  const [scheduled, setScheduled] = useState<Lecture[]>([]);
  useEffect(() => {
    void fetchCourses().then(setCourses).catch(() => {});
    void fetchScheduledLectures().then(setScheduled).catch(() => {});
  }, []);

  const loading = !activeSemester && semesters.length === 0 && !semError;

  const today = todayStr();
  const now = new Date();
  const anchor = settings?.odd_week_anchor ? fromDateStr(settings.odd_week_anchor) : mondayOf(now);
  const parity = getWeekParity(now, anchor);
  const todayWd = weekdayMon1(now);

  const todaySlots = slots
    .filter((s) => s.weekday === todayWd && slotMatchesParity(s.week_parity, parity))
    .sort((a, b) => a.pair_number - b.pair_number);
  const todayTasks = tasks.filter((t) => isOpen(t) && t.due === today);

  function courseFor(slot: ScheduleSlot): Course | undefined {
    return courses.find((c) => c.id === slot.subject);
  }

  async function startNote(slot: ScheduleSlot) {
    const lecturesOfSubject = await fetchLecturesOfSubject(slot.subject);
    const lec = await startNoteForSlot(slot, today, lecturesOfSubject);
    const c = courseFor(slot);
    navigate(c ? `/s/${semSlug}/${courseSlug(c)}/${lec.slug ?? lec.id}/edit` : `/note/${lec.slug ?? lec.id}/edit`);
  }

  function openLecture(lec: Lecture, slot: ScheduleSlot) {
    const c = courseFor(slot);
    navigate(c ? `/s/${semSlug}/${courseSlug(c)}` : `/note/${lec.slug ?? lec.id}`);
  }

  const week = useMemo(() => {
    const monday = startOfWeekMon(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return { date, key: heatmapDayKey(date) };
    });
  }, []);
  const todayKey = heatmapDayKey(new Date());

  const daysLeft = upcomingExam ? examDaysLeft(upcomingExam) : null;
  const readyCount = upcomingTickets.filter((t) => ticketStatus(t) === "ready").length;
  const examPercent = upcomingTickets.length
    ? Math.round((readyCount / upcomingTickets.length) * 100)
    : 0;

  if (loading) return <LoadingState />;

  return (
    <SemesterGate>
      <Header />
      <div className="c-dash">
        <div className="c-dash-head">
          <div>
            <span className="meta">{greetingDate()}</span>
            <h1>Привет, {userName(user!).split(" ")[0]}</h1>
          </div>
          <Button variant="secondary" onClick={() => navigate("/note/new")}>
            <Icon name="plus" size={18} />
            Новая лекция
          </Button>
        </div>

        <div className="c-dash-cols">
          <div className="c-dash-main">
            {lastVisited ? (
              <div className="c-dash-card c-dash-continue">
                <SubjectCover seed={lastVisited.courseCoverSeed} size={48} />
                <div className="c-dash-continue-tx">
                  <span className="label">Продолжить</span>
                  <span className="t">{lastVisited.title}</span>
                  <span className="m">
                    {lastVisited.courseName ? `${lastVisited.courseName} · ` : ""}
                    {timeAgo(lastVisited.savedAt)}
                  </span>
                </div>
                <Button variant="primary" onClick={() => navigate(lastVisited.to)}>
                  Открыть лекцию
                </Button>
              </div>
            ) : (
              <div className="c-dash-card c-dash-continue">
                <SubjectCover seed={null} size={48} />
                <div className="c-dash-continue-tx">
                  <span className="label">С чего начнём</span>
                  <span className="t">Создай первую заметку — она откроется здесь одним кликом</span>
                </div>
              </div>
            )}

            {todaySlots.length > 0 && (
              <div className="c-dash-card">
                <div className="c-dash-card-head">
                  <h2>Пары сегодня</h2>
                  <a href="/schedule" onClick={(e) => { e.preventDefault(); navigate("/schedule"); }}>
                    Расписание
                  </a>
                </div>
                {todaySlots.map((slot) => {
                  const lec = findLectureForOccurrence(slot, today, scheduled);
                  const c = courseFor(slot);
                  return (
                    <div key={slot.id} className="c-dash-row">
                      <span className="time">{pairTime(settings, slot.pair_number)}</span>
                      <SubjectCover seed={c?.cover_seed} size={40} />
                      <div className="tx">
                        <span className="t">{c ? courseName(c) : "Предмет"}</span>
                        <span className="m">
                          {kindLabel(slot)}
                          {slot.room ? ` · ауд. ${slot.room}` : ""}
                        </span>
                      </div>
                      {lec ? (
                        <Button variant="secondary" size="sm" onClick={() => openLecture(lec, slot)}>
                          Открыть конспект
                        </Button>
                      ) : (
                        <Button variant="soft" size="sm" onClick={() => void startNote(slot)}>
                          Начать конспект
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {todayTasks.length > 0 && (
              <div className="c-dash-card">
                <div className="c-dash-card-head">
                  <h2>На сегодня</h2>
                  <a href="/tasks" onClick={(e) => { e.preventDefault(); navigate("/tasks"); }}>
                    Все задачи
                  </a>
                </div>
                {todayTasks.map((t) => (
                  <div key={t.id} className="c-dash-task-row">
                    <button
                      type="button"
                      className={`check${!isOpen(t) ? " on" : ""}`}
                      aria-label={isOpen(t) ? "Отметить готовым" : "Вернуть в работу"}
                      aria-pressed={!isOpen(t)}
                      onClick={() => void setDone(t.id, isOpen(t))}
                    >
                      {!isOpen(t) && <Icon name="check" size={13} />}
                    </button>
                    <div className="tx">
                      <span className={`t${!isOpen(t) ? " done" : ""}`}>{t.title}</span>
                      {t.subject && <span className="m">{t.subject}</span>}
                    </div>
                    {isOpen(t) && <span className="due">Сегодня</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="c-dash-aside">
            {decks.length > 0 && (
              <div className="c-dash-card">
                <div className="c-dash-card-head">
                  <h2>Что повторить</h2>
                </div>
                {/* Подменяю данные: готовность лекции (spec §6, карточки «Повторить»/
                    «Слабо») это волна B5. Пока показываю последние колоды — ближайший
                    из уже существующих источников "что стоит повторить". */}
                {decks.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="c-dash-review-row"
                    onClick={() => navigate(`/decks/${deckSlug(d)}`)}
                  >
                    <SubjectCover seed={null} size={40} />
                    <div className="tx">
                      <span className="t">{deckTitle(d)}</span>
                      <span className="m">{timeAgo(d.updated)}</span>
                    </div>
                    <StatusChip tone="warn">Повторить</StatusChip>
                  </button>
                ))}
              </div>
            )}

            <div className="c-dash-card c-dash-week">
              <div className="c-dash-card-head">
                <h2>Эта неделя</h2>
              </div>
              <div className="grid">
                {week.map(({ date, key }) => {
                  const count = Math.min(heatmap.days.get(key) ?? 0, 3);
                  const isToday = key === todayKey;
                  return (
                    <div key={key} className="day">
                      <span className="wd">{WEEKDAYS[(date.getDay() + 6) % 7]}</span>
                      <span className={`num${isToday ? " on" : ""}`}>{date.getDate()}</span>
                      <span className="dots">
                        {Array.from({ length: count }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="legend">
                <i />
                Одно действие за день: правка конспекта, квиз или задача.
              </p>
            </div>

            {upcomingExam && daysLeft !== null && daysLeft >= 0 && (
              <div className="c-dash-card c-dash-exam">
                <div className="c-dash-card-head" style={{ alignItems: "baseline" }}>
                  <h2>Экзамен · {examTitle(upcomingExam)}</h2>
                  <a
                    href={`/s/${semSlug}/${upcomingExam.expand?.course ? courseSlug(upcomingExam.expand.course) : ""}/exam`}
                    onClick={(e) => {
                      e.preventDefault();
                      const c = upcomingExam.expand?.course;
                      navigate(`/s/${semSlug}/${c ? courseSlug(c) : ""}/exam`);
                    }}
                  >
                    Билеты
                  </a>
                </div>
                <span className="meta">
                  {daysLeft === 0 ? "Сегодня" : `Через ${daysLeft} ${pluralRu(daysLeft, ["день", "дня", "дней"])}`}
                </span>
                <div className="progress">
                  <div className="progress-head">
                    <span>Билеты готовы</span>
                    <span className="pct">{examPercent}%</span>
                  </div>
                  <div className="bar">
                    <div className="fill" style={{ width: `${examPercent}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SemesterGate>
  );
}
