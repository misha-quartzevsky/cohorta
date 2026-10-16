import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import {
  Button,
  Card,
  SegmentedControl,
  EmptyState,
  SubjectCover,
  Badge,
  Menu,
  useToast,
  type Segment,
} from "../components/ui";
import SlotForm from "../components/schedule/SlotForm";
import { useSchedule } from "../hooks/useSchedule";
import { useSemester } from "../lib/semesterContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import {
  startNoteForSlot,
  fetchLecturesOfSubject,
  fetchScheduledLectures,
  type SlotInput,
} from "../services/scheduleService";
import { fetchCourses } from "../services/courseService";
import type { Course, Lecture, ScheduleSlot } from "../lib/types";
import { courseName, courseSlug, semesterSlug } from "../lib/types";
import { pickActiveSemester } from "../lib/activeSemester";
import { lastSemesterSlug } from "../lib/lastSemester";
import {
  mondayOf,
  addDays,
  fromDateStr,
  toDateStr,
  todayStr,
  weekdayMon1,
} from "../lib/localDate";
import {
  getWeekParity,
  slotMatchesParity,
  findLectureForOccurrence,
  dateForWeekday,
} from "../lib/weekParity";
import { pluralRu } from "../lib/format";

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAY_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];
const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export default function SchedulePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { semesters } = useSemester();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const activeSemester = useMemo(() => pickActiveSemester(semesters), [semesters]);
  const semId = activeSemester?.id;
  const semSlug = activeSemester ? semesterSlug(activeSemester) : lastSemesterSlug();

  const { settings, slots, loading, error, createSlot, updateSlot, deleteSlot } =
    useSchedule(semId);

  const [courses, setCourses] = useState<Course[]>([]);
  const [scheduled, setScheduled] = useState<Lecture[]>([]);
  const reloadScheduled = () =>
    fetchScheduledLectures().then(setScheduled).catch(() => {});
  useEffect(() => {
    void fetchCourses().then(setCourses).catch(() => setCourses([]));
    void reloadScheduled();
  }, []);

  const anchor = settings?.odd_week_anchor
    ? fromDateStr(settings.odd_week_anchor)
    : mondayOf(new Date());

  const [refDate, setRefDate] = useState<Date>(() => new Date());
  const parity = getWeekParity(refDate, anchor);
  const monday = mondayOf(refDate);
  const showSaturday = settings?.show_saturday !== false;
  const dayCount = showSaturday ? 6 : 5;
  const pairTimes = settings?.pair_times ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<ScheduleSlot | null>(null);
  const [preset, setPreset] = useState<{ weekday?: number; pair_number?: number } | undefined>();

  const weekSlots = slots.filter((s) => slotMatchesParity(s.week_parity, parity));

  function switchParity(target: "odd" | "even") {
    if (parity === target) return;
    setRefDate((d) => addDays(d, 7));
  }

  function rangeLabel() {
    const end = addDays(monday, dayCount - 1);
    const sameMonth = monday.getMonth() === end.getMonth();
    const left = sameMonth
      ? `${monday.getDate()}`
      : `${monday.getDate()} ${MONTHS_GEN[monday.getMonth()]}`;
    return `${left}–${end.getDate()} ${MONTHS_GEN[end.getMonth()]}`;
  }

  async function handleStartNote(slot: ScheduleSlot, dateStr: string) {
    const course = courses.find((c) => c.id === slot.subject);
    const lecturesOfSubject = await fetchLecturesOfSubject(slot.subject);
    const lecture = await startNoteForSlot(slot, dateStr, lecturesOfSubject);
    await reloadScheduled();
    if (course) {
      navigate(`/s/${semSlug}/${courseSlug(course)}/${lecture.slug ?? lecture.id}/edit`);
    } else {
      navigate(`/note/${lecture.slug ?? lecture.id}/edit`);
    }
  }

  function openLecture(lec: Lecture, slot: ScheduleSlot) {
    const course = courses.find((c) => c.id === slot.subject);
    if (course) {
      navigate(`/s/${semSlug}/${courseSlug(course)}/${lec.slug ?? lec.id}`);
    } else {
      navigate(`/note/${lec.slug ?? lec.id}`);
    }
  }

  async function handleSave(input: SlotInput) {
    const payload = { ...input, semester: semId };
    if (editSlot) await updateSlot(editSlot.id, payload);
    else await createSlot(payload);
    setEditSlot(null);
    setPreset(undefined);
  }

  if (loading && slots.length === 0) return <LoadingState />;

  const parityTabs: Segment<"odd" | "even">[] = [
    { value: "odd", label: "Нечётная" },
    { value: "even", label: "Чётная" },
  ];

  const hasSlots = slots.length > 0;

  return (
    <>
      <Header
        crumbs={[{ label: "Рабочий стол", to: `/s/${semSlug}` }, { label: "Расписание" }]}
      />
      <div className="ds-page ds-root">
        <div className="ds-page__inner">
          <ErrorBanner message={error} />

          <div className="ds-page__head">
            <div className="ds-page__title-group">
              <h1 className="ds-h1">Расписание</h1>
              <p className="ds-page__subtitle ds-body">
                {parity === "odd" ? "Нечётная неделя" : "Чётная неделя"} ·{" "}
                {weekSlots.length} {pluralRu(weekSlots.length, ["пара", "пары", "пар"])}
              </p>
            </div>
            <Button
              onClick={() => {
                setEditSlot(null);
                setPreset(undefined);
                setFormOpen(true);
              }}
            >
              <Plus size={16} /> Добавить пару
            </Button>
          </div>

          {!hasSlots ? (
            <ScheduleEmpty onAdd={() => setFormOpen(true)} onSoon={() => toast.show("Скоро")} />
          ) : (
            <div className="ds-page__cols">
              <div>
                <div className="ds-toolbar">
                  <SegmentedControl
                    segments={parityTabs}
                    value={parity}
                    onChange={switchParity}
                    ariaLabel="Чётность недели"
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <button
                      type="button"
                      className="ds-icon-btn"
                      aria-label="Предыдущая неделя"
                      onClick={() => setRefDate((d) => addDays(d, -7))}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="ds-caption ds-numeric">{rangeLabel()}</span>
                    <button
                      type="button"
                      className="ds-icon-btn"
                      aria-label="Следующая неделя"
                      onClick={() => setRefDate((d) => addDays(d, 7))}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                <div className="ds-legend">
                  <div className="ds-legend__item">
                    <SubjectCover subjectId="legend" paletteKey="civil" size={20} />
                    Конспект есть
                  </div>
                  <div className="ds-legend__item">
                    <span className="ds-legend__swatch ds-legend__swatch--note" />
                    Конспекта нет
                  </div>
                </div>

                {isMobile ? (
                  <MobileDayList
                    dayCount={dayCount}
                    pairTimes={pairTimes}
                    monday={monday}
                    weekSlots={weekSlots}
                    scheduled={scheduled}
                    onEdit={(s) => {
                      setEditSlot(s);
                      setFormOpen(true);
                    }}
                    onOpen={openLecture}
                    onStart={handleStartNote}
                  />
                ) : (
                  <WeekGrid
                    dayCount={dayCount}
                    pairTimes={pairTimes}
                    monday={monday}
                    weekSlots={weekSlots}
                    scheduled={scheduled}
                    onEmptyCell={(weekday, pair_number) => {
                      setEditSlot(null);
                      setPreset({ weekday, pair_number });
                      setFormOpen(true);
                    }}
                    onEdit={(s) => {
                      setEditSlot(s);
                      setFormOpen(true);
                    }}
                    onOpen={openLecture}
                    onStart={handleStartNote}
                    onDelete={(id) => void deleteSlot(id)}
                  />
                )}
              </div>

              <SchedulePanel
                weekSlots={weekSlots}
                monday={monday}
                scheduled={scheduled}
                courses={courses}
                onStart={handleStartNote}
              />
            </div>
          )}
        </div>
      </div>

      <SlotForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditSlot(null);
          setPreset(undefined);
        }}
        courses={courses}
        pairTimes={pairTimes}
        preset={preset}
        slot={editSlot}
        onSave={handleSave}
        onDelete={editSlot ? () => deleteSlot(editSlot.id) : undefined}
      />
    </>
  );
}

/* ---------- Сетка (десктоп/планшет) ---------- */

interface GridProps {
  dayCount: number;
  pairTimes: { n: number; start: string; end: string }[];
  monday: Date;
  weekSlots: ScheduleSlot[];
  scheduled: Lecture[];
  onEmptyCell: (weekday: number, pair_number: number) => void;
  onEdit: (slot: ScheduleSlot) => void;
  onOpen: (lec: Lecture, slot: ScheduleSlot) => void;
  onStart: (slot: ScheduleSlot, dateStr: string) => void;
  onDelete: (id: string) => void;
}

function WeekGrid({
  dayCount,
  pairTimes,
  monday,
  weekSlots,
  scheduled,
  onEmptyCell,
  onEdit,
  onOpen,
  onStart,
  onDelete,
}: GridProps) {
  const today = todayStr();
  const todayWd = weekdayMon1(new Date());
  const template = `72px repeat(${dayCount}, 1fr)`;

  return (
    <div className="ds-schedule-scroll">
      <div className="ds-grid" style={{ gridTemplateColumns: template }}>
        <div />
        {Array.from({ length: dayCount }, (_, i) => {
          const date = addDays(monday, i);
          const isToday = toDateStr(date) === today;
          return (
            <div
              key={i}
              className={`ds-grid__dayhead${isToday ? " ds-grid__dayhead--today" : ""}`}
            >
              {isToday && <span className="ds-dot ds-dot--accent" />}
              {DAY_NAMES[i]} {date.getDate()}
            </div>
          );
        })}

        {pairTimes.map((pt) => (
          <RowFragment
            key={pt.n}
            pt={pt}
            dayCount={dayCount}
            monday={monday}
            weekSlots={weekSlots}
            scheduled={scheduled}
            todayWd={todayWd}
            today={today}
            onEmptyCell={onEmptyCell}
            onEdit={onEdit}
            onOpen={onOpen}
            onStart={onStart}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function RowFragment({
  pt,
  dayCount,
  monday,
  weekSlots,
  scheduled,
  todayWd,
  today,
  onEmptyCell,
  onEdit,
  onOpen,
  onStart,
  onDelete,
}: {
  pt: { n: number; start: string; end: string };
  dayCount: number;
  monday: Date;
  weekSlots: ScheduleSlot[];
  scheduled: Lecture[];
  todayWd: number;
  today: string;
  onEmptyCell: (weekday: number, pair_number: number) => void;
  onEdit: (slot: ScheduleSlot) => void;
  onOpen: (lec: Lecture, slot: ScheduleSlot) => void;
  onStart: (slot: ScheduleSlot, dateStr: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="ds-grid__time">
        <strong>{pt.n}</strong>
        <span>{pt.start}</span>
        <span>{pt.end}</span>
      </div>
      {Array.from({ length: dayCount }, (_, i) => {
        const weekday = i + 1;
        const dateStr = toDateStr(addDays(monday, i));
        const slot = weekSlots.find(
          (s) => s.weekday === weekday && s.pair_number === pt.n
        );
        const isTodayCol = weekday === todayWd;
        return (
          <div
            key={i}
            className={isTodayCol ? "ds-grid__col-today" : undefined}
            style={{ padding: 2 }}
          >
            {slot ? (
              <SlotCard
                slot={slot}
                dateStr={dateStr}
                today={today}
                scheduled={scheduled}
                onEdit={onEdit}
                onOpen={onOpen}
                onStart={onStart}
                onDelete={onDelete}
              />
            ) : (
              <button
                type="button"
                className="ds-empty-cell"
                aria-label="Добавить пару"
                onClick={() => onEmptyCell(weekday, pt.n)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------- Карточка слота ---------- */

function SlotCard({
  slot,
  dateStr,
  today,
  scheduled,
  onEdit,
  onOpen,
  onStart,
  onDelete,
}: {
  slot: ScheduleSlot;
  dateStr: string;
  today: string;
  scheduled: Lecture[];
  onEdit: (slot: ScheduleSlot) => void;
  onOpen: (lec: Lecture, slot: ScheduleSlot) => void;
  onStart: (slot: ScheduleSlot, dateStr: string) => void;
  onDelete: (id: string) => void;
}) {
  const subject = slot.expand?.subject;
  const name = subject ? courseName(subject) : "Предмет";
  const lecture = findLectureForOccurrence(slot, dateStr, scheduled);
  const kindLabel =
    slot.kind === "seminar"
      ? "Семинар"
      : slot.kind === "lab"
        ? "Лаб."
        : slot.kind === "other"
          ? "Пара"
          : "Лекция";
  const sub = slot.room ? `${kindLabel} · ауд. ${slot.room}` : kindLabel;

  if (lecture) {
    return (
      <button
        type="button"
        className="ds-slot ds-slot--has-note"
        onClick={() => onOpen(lecture, slot)}
      >
        <SubjectCover
          subjectId={slot.subject}
          paletteKey={subject?.color}
          wide
          height={56}
          className="ds-slot__cover"
        />
        <div className="ds-slot__body">
          <div className="ds-slot__title">{name}</div>
          <div className="ds-slot__sub">{sub}</div>
        </div>
      </button>
    );
  }

  const canStart = dateStr === today;
  return (
    <Menu
      trigger={({ ref, onClick, ...aria }) => (
        <button
          ref={ref}
          type="button"
          className="ds-slot ds-slot--note"
          onClick={onClick}
          {...aria}
        >
          <div className="ds-slot__body">
            <div className="ds-slot__title">{name}</div>
            <div className="ds-slot__sub">{sub}</div>
            {canStart && (
              <div style={{ marginTop: 4 }}>
                <Badge tone="accent">Начать конспект</Badge>
              </div>
            )}
          </div>
        </button>
      )}
      items={[
        { label: "Начать конспект", onClick: () => onStart(slot, dateStr) },
        { label: "Изменить пару", onClick: () => onEdit(slot) },
        { label: "Удалить пару", onClick: () => onDelete(slot.id), danger: true },
      ]}
    />
  );
}

/* ---------- Мобильный список дней (spec 9.1) ---------- */

function MobileDayList({
  dayCount,
  pairTimes,
  monday,
  weekSlots,
  scheduled,
  onEdit,
  onOpen,
  onStart,
}: {
  dayCount: number;
  pairTimes: { n: number; start: string; end: string }[];
  monday: Date;
  weekSlots: ScheduleSlot[];
  scheduled: Lecture[];
  onEdit: (slot: ScheduleSlot) => void;
  onOpen: (lec: Lecture, slot: ScheduleSlot) => void;
  onStart: (slot: ScheduleSlot, dateStr: string) => void;
}) {
  const today = todayStr();
  return (
    <div>
      {Array.from({ length: dayCount }, (_, i) => {
        const weekday = i + 1;
        const date = addDays(monday, i);
        const dateStr = toDateStr(date);
        const isToday = dateStr === today;
        const daySlots = weekSlots
          .filter((s) => s.weekday === weekday)
          .sort((a, b) => a.pair_number - b.pair_number);
        if (daySlots.length === 0) return null;
        return (
          <div key={i} className="ds-day">
            <div className="ds-day__head">
              {isToday && <span className="ds-dot ds-dot--accent" />}
              {DAY_FULL[i]}, {date.getDate()} {MONTHS_GEN[date.getMonth()]}
            </div>
            {daySlots.map((slot) => {
              const pt = pairTimes.find((p) => p.n === slot.pair_number);
              return (
                <div key={slot.id} className="ds-day__row">
                  <div className="ds-day__time">
                    <div>{slot.pair_number} пара</div>
                    {pt && <div>{pt.start}</div>}
                  </div>
                  <div className="ds-day__slot">
                    <SlotCard
                      slot={slot}
                      dateStr={dateStr}
                      today={today}
                      scheduled={scheduled}
                      onEdit={onEdit}
                      onOpen={onOpen}
                      onStart={onStart}
                      onDelete={() => {}}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Правая панель ---------- */

function SchedulePanel({
  weekSlots,
  monday,
  scheduled,
  courses,
  onStart,
}: {
  weekSlots: ScheduleSlot[];
  monday: Date;
  scheduled: Lecture[];
  courses: Course[];
  onStart: (slot: ScheduleSlot, dateStr: string) => void;
}) {
  const today = todayStr();
  // Прошедшие пары недели без конспекта (до 5).
  const pastWithoutNote: { slot: ScheduleSlot; dateStr: string }[] = [];
  let weekTotal = 0;
  let weekWithNote = 0;
  for (const slot of weekSlots) {
    const dateStr = dateForWeekday(monday, slot.weekday);
    const started = dateStr <= today;
    if (started) {
      weekTotal += 1;
      const lec = findLectureForOccurrence(slot, dateStr, scheduled);
      if (lec) weekWithNote += 1;
      else if (dateStr < today) pastWithoutNote.push({ slot, dateStr });
    }
  }

  function subjName(slot: ScheduleSlot) {
    const c = courses.find((x) => x.id === slot.subject);
    return c ? courseName(c) : "Предмет";
  }

  return (
    <aside className="ds-panel">
      <Card>
        <h3 className="ds-h3" style={{ marginBottom: "var(--space-2)" }}>
          Эта неделя
        </h3>
        <p className="ds-body">
          {weekWithNote} из {weekTotal}{" "}
          {pluralRu(weekTotal, ["пары", "пар", "пар"])} с конспектом
        </p>
        {pastWithoutNote.length > 0 && (
          <div style={{ marginTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {pastWithoutNote.slice(0, 5).map(({ slot, dateStr }) => (
              <button
                key={slot.id + dateStr}
                type="button"
                className="ds-menu__item"
                onClick={() => onStart(slot, dateStr)}
              >
                <span className="ds-dot ds-dot--danger" />
                <span style={{ flex: 1, textAlign: "left" }}>{subjName(slot)}</span>
                <span className="ds-caption ds-subtle-text">нет конспекта</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </aside>
  );
}

/* ---------- Пустое состояние (spec 4.6) ---------- */

function ScheduleEmpty({ onAdd, onSoon }: { onAdd: () => void; onSoon: () => void }) {
  return (
    <EmptyState
      title="Расписание пока пустое"
      text="Добавь пары вручную — остальное подтянется из конспектов."
      actions={
        <>
          <Button onClick={onAdd}>Добавить пару вручную</Button>
          <Button variant="secondary" onClick={onSoon}>
            Загрузить фото или файл
          </Button>
          <Button variant="secondary" onClick={onSoon}>
            Взять расписание группы
          </Button>
        </>
      }
    />
  );
}
