/**
 * ============================================
 *  SchedulePageNew.tsx — «Расписание» (B3, 2026-10-20)
 * ============================================
 *
 * Вёрстка 1:1 по docs/design/screens/Screen-schedule(-m).dc.html.
 * Главное правило дизайна (spec 4.2): конспект есть → карточка с
 * градиентной обложкой предмета; конспекта нет → белая карточка.
 * Десктоп/телефон — оба блока в разметке, переключение по CSS
 * (брейкпоинт 1023px), как в LecturesAllPage (B2), не useMediaQuery.
 *
 * Расхождение с Screen-m-schedule.png, не исправлено молча (см. отчёт
 * владелице): на мобильном макете последняя карточка «Философия» без
 * конспекта всё равно показана с градиентом обложки — это противоречит
 * главному правилу 4.2 и десктопному макету той же волны. Реализовано
 * по тексту спецификации и по десктопу (белая карточка без градиента),
 * расхождение зафиксировано в docs/decisions.md.
 *
 * За флагом VITE_NEW_UI — подключена в App.tsx вместо SchedulePage.tsx
 * только когда isNewUI().
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MobileSearchButton from "../components/MobileSearchButton";
import { ChevronRight } from "lucide-react";

import { useForms } from "../lib/formsContext";
import { Button, Icon, Pills, StatusChip, SubjectCover, EmptyState, Menu } from "../ui";
import SlotFormNew from "../components/schedule/SlotFormNew";
import AttachLectureModal from "../components/schedule/AttachLectureModal";
import { useSchedule } from "../hooks/useSchedule";
import { useSemester } from "../lib/semesterContext";
import {
  startNoteForSlot,
  fetchLecturesOfSubject,
  fetchScheduledLectures,
  fetchSlotLectureLinks,
  createSlotLectureLink,
  type SlotInput,
} from "../services/scheduleService";
import { fetchCourses } from "../services/courseService";
import type { Course, Lecture, ScheduleSlot, ScheduleSlotLecture } from "../lib/types";
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
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

type Parity = "odd" | "even";

export default function SchedulePageNew() {
  const navigate = useNavigate();
  const forms = useForms();
  const { semesters } = useSemester();

  const activeSemester = useMemo(() => pickActiveSemester(semesters), [semesters]);
  const semId = activeSemester?.id;
  const semSlug = activeSemester ? semesterSlug(activeSemester) : lastSemesterSlug();

  const { settings, slots, createSlot, updateSlot, deleteSlot } = useSchedule(semId);

  const [courses, setCourses] = useState<Course[]>([]);
  const [scheduled, setScheduled] = useState<Lecture[]>([]);
  const [links, setLinks] = useState<ScheduleSlotLecture[]>([]);
  const reloadScheduled = () =>
    fetchScheduledLectures().then(setScheduled).catch(() => {});
  const reloadLinks = () => fetchSlotLectureLinks().then(setLinks).catch(() => {});
  useEffect(() => {
    void fetchCourses().then(setCourses).catch(() => setCourses([]));
    void reloadScheduled();
    void reloadLinks();
  }, []);

  // «Добавить конспект» (B3): прикрепить уже существующую лекцию предмета
  // к пустой паре на конкретную дату — не создаёт новую лекцию.
  const [attachTarget, setAttachTarget] = useState<{ slot: ScheduleSlot; dateStr: string } | null>(
    null
  );
  const [attachLectures, setAttachLectures] = useState<Lecture[]>([]);

  function openAttachModal(slot: ScheduleSlot, dateStr: string) {
    setAttachTarget({ slot, dateStr });
    void fetchLecturesOfSubject(slot.subject).then(setAttachLectures).catch(() => setAttachLectures([]));
  }

  async function handleAttach(lectureId: string) {
    if (!attachTarget) return;
    await createSlotLectureLink(attachTarget.slot.id, lectureId, attachTarget.dateStr);
    await reloadLinks();
  }

  const anchor = settings?.odd_week_anchor
    ? fromDateStr(settings.odd_week_anchor)
    : mondayOf(new Date());

  const [refDate, setRefDate] = useState<Date>(() => new Date());
  const parity: Parity = getWeekParity(refDate, anchor);
  const monday = mondayOf(refDate);
  const showSaturday = settings?.show_saturday !== false;
  const dayCount = showSaturday ? 6 : 5;
  const pairTimes = settings?.pair_times ?? [];

  const today = todayStr();
  const todayWd = weekdayMon1(new Date());
  const [mobileDay, setMobileDay] = useState<number>(todayWd <= dayCount ? todayWd : 1);

  // «Добавить» у шага «Добавь пары» на пустой Главной ведёт сюда с ?add=1 и сразу открывает форму.
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(searchParams.get("add") === "1");
  useEffect(() => {
    if (searchParams.get("add") === "1") setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);
  const [editSlot, setEditSlot] = useState<ScheduleSlot | null>(null);
  const [preset, setPreset] = useState<{ weekday?: number; pair_number?: number } | undefined>();

  const weekSlots = slots.filter((s) => slotMatchesParity(s.week_parity, parity));
  const todaySlotsCount = weekSlots.filter((s) => s.weekday === todayWd).length;

  function switchParity(target: Parity) {
    if (parity === target) return;
    setRefDate((d) => addDays(d, target === "even" ? 7 : -7));
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

  const hasSlots = slots.length > 0;

  return (
    <div className="c-schedule">
      {/* Десктоп: заголовок + «Добавить пару». */}
      <div className="c-schedule-head">
        <div className="c-schedule-head-tx">
          <h1>Расписание</h1>
          <span>
            {parity === "odd" ? "Нечётная неделя" : "Чётная неделя"} ·{" "}
            {weekSlots.length} {pluralRu(weekSlots.length, ["пара", "пары", "пар"])}
          </span>
        </div>
        <Button
          onClick={() => {
            setEditSlot(null);
            setPreset(undefined);
            setFormOpen(true);
          }}
        >
          <Icon name="plus" size={18} />
          Добавить пару
        </Button>
      </div>

      {/* Телефон: заголовок, без кнопки добавления в шапке (мокап). */}
      <div className="c-schedule-m-head">
        <MobileSearchButton />
        <h1>Расписание</h1>
        <span>
          {parity === "odd" ? "Нечётная неделя" : "Чётная неделя"} · {todaySlotsCount}{" "}
          {pluralRu(todaySlotsCount, ["пара", "пары", "пар"])} сегодня
        </span>
      </div>

      {!hasSlots ? (
        <ScheduleEmpty onAdd={() => setFormOpen(true)} />
      ) : (
        <>
          {/* Десктоп: переключатель чётности + навигация по неделям + легенда. */}
          <div className="c-schedule-toolbar">
            <Pills
              aria-label="Чётность недели"
              value={parity}
              onChange={switchParity}
              options={[
                { value: "odd", label: "Нечётная" },
                { value: "even", label: "Чётная" },
              ]}
            />
            <div className="c-schedule-weeknav">
              <button
                type="button"
                className="c-schedule-weeknav-btn"
                aria-label="Предыдущая неделя"
                onClick={() => setRefDate((d) => addDays(d, -7))}
              >
                <ChevronRight size={16} style={{ transform: "scaleX(-1)" }} />
              </button>
              <span>{rangeLabel()}</span>
              <button
                type="button"
                className="c-schedule-weeknav-btn"
                aria-label="Следующая неделя"
                onClick={() => setRefDate((d) => addDays(d, 7))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="c-schedule-legend">
              <span className="c-schedule-legend-item">
                <SubjectCover seed={30} size={20} />
                Конспект есть
              </span>
              <span className="c-schedule-legend-item">
                <span className="c-schedule-legend-swatch" />
                Конспекта нет
              </span>
            </div>
          </div>

          <div className="c-schedule-cols">
            <div className="c-schedule-grid-wrap">
              <WeekGrid
                dayCount={dayCount}
                pairTimes={pairTimes}
                monday={monday}
                weekSlots={weekSlots}
                scheduled={scheduled}
                links={links}
                todayWd={todayWd}
                today={today}
                courses={courses}
                semSlug={semSlug}
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
                onAttach={openAttachModal}
                onDelete={(id) => void deleteSlot(id)}
              />

              {/* Телефон: дни недели пилюлями + список пар выбранного дня. */}
              <div className="c-schedule-m-days">
                {Array.from({ length: dayCount }, (_, i) => {
                  const weekday = i + 1;
                  const date = addDays(monday, i);
                  return (
                    <button
                      key={weekday}
                      type="button"
                      className={`c-schedule-m-day${mobileDay === weekday ? " on" : ""}`}
                      onClick={() => setMobileDay(weekday)}
                    >
                      <span>{DAY_NAMES[i]}</span>
                      <strong>{date.getDate()}</strong>
                    </button>
                  );
                })}
              </div>
              <div className="c-schedule-m-list">
                <MobileDayPairs
                  weekday={mobileDay}
                  dateStr={dateForWeekday(monday, mobileDay)}
                  pairTimes={pairTimes}
                  weekSlots={weekSlots}
                  scheduled={scheduled}
                  links={links}
                  today={today}
                  courses={courses}
                  onOpen={openLecture}
                  onStart={handleStartNote}
                  onAttach={openAttachModal}
                />
              </div>
            </div>

            <SchedulePanel
              allSlots={slots}
              anchor={anchor}
              pairTimes={pairTimes}
              scheduled={scheduled}
              links={links}
              courses={courses}
              onStart={handleStartNote}
            />
          </div>
        </>
      )}

      <SlotFormNew
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditSlot(null);
          setPreset(undefined);
        }}
        courses={courses}
        pairTimes={pairTimes}
        slots={slots}
        onAddSubject={forms ? forms.openSubjectForm : undefined}
        preset={preset}
        slot={editSlot}
        onSave={handleSave}
        onDelete={editSlot ? () => deleteSlot(editSlot.id) : undefined}
      />

      <AttachLectureModal
        open={!!attachTarget}
        onClose={() => setAttachTarget(null)}
        lectures={attachLectures}
        onAttach={handleAttach}
      />
    </div>
  );
}

/* ---------- Сетка (десктоп/планшет) ---------- */

interface GridProps {
  dayCount: number;
  pairTimes: { n: number; start: string; end: string }[];
  monday: Date;
  weekSlots: ScheduleSlot[];
  scheduled: Lecture[];
  links: ScheduleSlotLecture[];
  todayWd: number;
  today: string;
  courses: Course[];
  semSlug: string;
  onEmptyCell: (weekday: number, pair_number: number) => void;
  onEdit: (slot: ScheduleSlot) => void;
  onOpen: (lec: Lecture, slot: ScheduleSlot) => void;
  onStart: (slot: ScheduleSlot, dateStr: string) => void;
  onAttach: (slot: ScheduleSlot, dateStr: string) => void;
  onDelete: (id: string) => void;
}

function WeekGrid({
  dayCount,
  pairTimes,
  monday,
  weekSlots,
  scheduled,
  links,
  todayWd,
  today,
  courses,
  semSlug,
  onEmptyCell,
  onEdit,
  onOpen,
  onStart,
  onAttach,
  onDelete,
}: GridProps) {
  const template = `56px repeat(${dayCount}, minmax(0, 1fr))`;

  return (
    <div className="c-schedule-grid" style={{ gridTemplateColumns: template }}>
      <div />
      {Array.from({ length: dayCount }, (_, i) => {
        const date = addDays(monday, i);
        const isToday = toDateStr(date) === today;
        return (
          <div key={i} className={`c-schedule-dayhead${isToday ? " today" : ""}`}>
            {isToday && <span className="c-dot c-dot-accent" />}
            {DAY_NAMES[i]} {date.getDate()}
          </div>
        );
      })}

      {pairTimes.map((pt) => (
        <GridRow
          key={pt.n}
          pt={pt}
          dayCount={dayCount}
          monday={monday}
          weekSlots={weekSlots}
          scheduled={scheduled}
          links={links}
          todayWd={todayWd}
          today={today}
          courses={courses}
          semSlug={semSlug}
          onEmptyCell={onEmptyCell}
          onEdit={onEdit}
          onOpen={onOpen}
          onStart={onStart}
          onAttach={onAttach}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function GridRow({
  pt,
  dayCount,
  monday,
  weekSlots,
  scheduled,
  links,
  todayWd,
  today,
  courses,
  semSlug,
  onEmptyCell,
  onEdit,
  onOpen,
  onStart,
  onAttach,
  onDelete,
}: {
  pt: { n: number; start: string; end: string };
  dayCount: number;
  monday: Date;
  weekSlots: ScheduleSlot[];
  scheduled: Lecture[];
  links: ScheduleSlotLecture[];
  todayWd: number;
  today: string;
  courses: Course[];
  semSlug: string;
  onEmptyCell: (weekday: number, pair_number: number) => void;
  onEdit: (slot: ScheduleSlot) => void;
  onOpen: (lec: Lecture, slot: ScheduleSlot) => void;
  onStart: (slot: ScheduleSlot, dateStr: string) => void;
  onAttach: (slot: ScheduleSlot, dateStr: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="c-schedule-time">
        <strong>{pt.n}</strong>
        <span>{pt.start}</span>
      </div>
      {Array.from({ length: dayCount }, (_, i) => {
        const weekday = i + 1;
        const dateStr = toDateStr(addDays(monday, i));
        const slot = weekSlots.find((s) => s.weekday === weekday && s.pair_number === pt.n);
        const isTodayCol = weekday === todayWd;
        return (
          <div key={i} className={`c-schedule-cell${isTodayCol ? " today" : ""}`}>
            {slot ? (
              <SlotCard
                slot={slot}
                dateStr={dateStr}
                today={today}
                scheduled={scheduled}
                links={links}
                courses={courses}
                semSlug={semSlug}
                onEdit={onEdit}
                onOpen={onOpen}
                onStart={onStart}
                onAttach={onAttach}
                onDelete={onDelete}
              />
            ) : (
              <button
                type="button"
                className="c-schedule-empty-cell"
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

/* ---------- Карточка пары (десктоп-сетка) ---------- */

function SlotCard({
  slot,
  dateStr,
  today,
  scheduled,
  links,
  courses,
  semSlug,
  onEdit,
  onOpen,
  onStart,
  onAttach,
  onDelete,
}: {
  slot: ScheduleSlot;
  dateStr: string;
  today: string;
  scheduled: Lecture[];
  links: ScheduleSlotLecture[];
  courses: Course[];
  semSlug: string;
  onEdit: (slot: ScheduleSlot) => void;
  onOpen: (lec: Lecture, slot: ScheduleSlot) => void;
  onStart: (slot: ScheduleSlot, dateStr: string) => void;
  onAttach: (slot: ScheduleSlot, dateStr: string) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const subject = slot.expand?.subject ?? courses.find((c) => c.id === slot.subject);
  const name = subject ? courseName(subject) : "Предмет";
  const lecture = findLectureForOccurrence(slot, dateStr, scheduled, links);
  const kindLabel =
    slot.kind === "seminar" ? "Семинар" : slot.kind === "lab" ? "Лаб." : slot.kind === "other" ? "Пара" : "Лекция";

  if (lecture) {
    return (
      <button type="button" className="c-schedule-slot has-note" onClick={() => onOpen(lecture, slot)}>
        <SubjectCover seed={subject?.cover_seed} wide height={999} className="c-schedule-slot-cover" />
        <div className="c-schedule-slot-body">
          <div className="t">{name}</div>
          <div className="m">
            {kindLabel}
            {slot.room ? ` · ${slot.room}` : ""}
          </div>
        </div>
      </button>
    );
  }

  const canStart = dateStr >= today;
  return (
    <Menu
      trigger={({ ref, onClick, ...aria }) => (
        <button ref={ref} type="button" className="c-schedule-slot no-note" onClick={onClick} {...aria}>
          <div className="c-schedule-slot-body">
            <div className="t">{name}</div>
            <div className="m">{slot.room ? `${kindLabel} · ауд. ${slot.room}` : kindLabel}</div>
            {canStart && dateStr === today && (
              <StatusChip tone="accent" dot={false} className="c-schedule-start-badge">
                Начать конспект
              </StatusChip>
            )}
          </div>
        </button>
      )}
      items={[
        { label: "Начать конспект", onClick: () => onStart(slot, dateStr) },
        { label: "Добавить конспект", onClick: () => onAttach(slot, dateStr) },
        { label: "Изменить пару", onClick: () => onEdit(slot) },
        ...(subject
          ? [
              {
                label: "Пары предмета",
                onClick: () => navigate(`/s/${semSlug}/${courseSlug(subject)}/pairs`),
              },
            ]
          : []),
        { label: "Удалить пару", onClick: () => onDelete(slot.id), danger: true },
      ]}
    />
  );
}

/* ---------- Телефон: пары выбранного дня ---------- */

function MobileDayPairs({
  weekday,
  dateStr,
  pairTimes,
  weekSlots,
  scheduled,
  links,
  today,
  courses,
  onOpen,
  onStart,
  onAttach,
}: {
  weekday: number;
  dateStr: string;
  pairTimes: { n: number; start: string; end: string }[];
  weekSlots: ScheduleSlot[];
  scheduled: Lecture[];
  links: ScheduleSlotLecture[];
  today: string;
  courses: Course[];
  onOpen: (lec: Lecture, slot: ScheduleSlot) => void;
  onStart: (slot: ScheduleSlot, dateStr: string) => void;
  onAttach: (slot: ScheduleSlot, dateStr: string) => void;
}) {
  const daySlots = weekSlots
    .filter((s) => s.weekday === weekday)
    .sort((a, b) => a.pair_number - b.pair_number);

  if (daySlots.length === 0) {
    return <p className="c-schedule-m-empty">В этот день пар нет.</p>;
  }

  return (
    <>
      {daySlots.map((slot) => {
        const pt = pairTimes.find((p) => p.n === slot.pair_number);
        const subject = slot.expand?.subject ?? courses.find((c) => c.id === slot.subject);
        const name = subject ? courseName(subject) : "Предмет";
        const lecture = findLectureForOccurrence(slot, dateStr, scheduled, links);
        const kindLabel =
          slot.kind === "seminar" ? "Семинар" : slot.kind === "lab" ? "Лаб." : slot.kind === "other" ? "Пара" : "Лекция";
        const canStart = dateStr >= today;
        return (
          <div key={slot.id} className="c-schedule-m-row">
            <div className="c-schedule-m-time">
              <strong>{slot.pair_number}</strong>
              {pt && <span>{pt.start}</span>}
            </div>
            {lecture ? (
              <button
                type="button"
                className="c-schedule-m-card has-note c-cover"
                style={
                  typeof subject?.cover_seed === "number"
                    ? ({ "--h": subject.cover_seed } as CSSProperties)
                    : undefined
                }
                onClick={() => onOpen(lecture, slot)}
              >
                <span className="t">{name}</span>
                <span className="m">{kindLabel}{slot.room ? ` · ${slot.room}` : ""}</span>
              </button>
            ) : (
              <div className="c-schedule-m-card no-note">
                <span className="t">{name}</span>
                <span className="m">{slot.room ? `${kindLabel} · ауд. ${slot.room}` : kindLabel}</span>
                <div className="c-schedule-m-start-row">
                  {canStart && (
                    <Button size="sm" onClick={() => onStart(slot, dateStr)} className="c-schedule-m-start">
                      Начать конспект
                    </Button>
                  )}
                  <Menu
                    trigger={({ ref, onClick, ...aria }) => (
                      <button
                        ref={ref}
                        type="button"
                        className="c-task-row-menu-btn"
                        aria-label="Действия с парой"
                        onClick={onClick}
                        {...aria}
                      >
                        <Icon name="dots" size={18} />
                      </button>
                    )}
                    items={[
                      ...(canStart
                        ? [{ label: "Начать конспект", onClick: () => onStart(slot, dateStr) }]
                        : []),
                      { label: "Добавить конспект", onClick: () => onAttach(slot, dateStr) },
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------- Правая панель ---------- */

function SchedulePanel({
  allSlots,
  anchor,
  pairTimes,
  scheduled,
  links,
  courses,
  onStart,
}: {
  allSlots: ScheduleSlot[];
  anchor: Date;
  pairTimes: { n: number; start: string; end: string }[];
  scheduled: Lecture[];
  links: ScheduleSlotLecture[];
  courses: Course[];
  onStart: (slot: ScheduleSlot, dateStr: string) => void;
}) {
  const today = todayStr();
  // Панель не зависит от того, какую неделю пролистал пользователь в сетке —
  // «Следующая пара» и «Эта неделя» всегда про реальную текущую неделю.
  const now = new Date();
  const realMonday = mondayOf(now);
  const realParity = getWeekParity(now, anchor);
  const thisWeekSlots = allSlots.filter((s) => slotMatchesParity(s.week_parity, realParity));

  // Следующая пара: ближайший слот от сегодня вперёд (до 14 дней, чтобы
  // учесть обе чётности), а не только в пределах отображаемой недели.
  const upcoming = allSlots
    .flatMap((slot) =>
      Array.from({ length: 14 }, (_, i) => toDateStr(addDays(fromDateStr(today), i)))
        .filter((dateStr) => weekdayMon1(fromDateStr(dateStr)) === slot.weekday)
        .filter((dateStr) => slotMatchesParity(slot.week_parity, getWeekParity(fromDateStr(dateStr), anchor)))
        .map((dateStr) => ({ slot, dateStr }))
    )
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.slot.pair_number - b.slot.pair_number)[0];

  const pastWithoutNote: { slot: ScheduleSlot; dateStr: string }[] = [];
  let weekTotal = 0;
  let weekWithNote = 0;
  for (const slot of thisWeekSlots) {
    const dateStr = dateForWeekday(realMonday, slot.weekday);
    const started = dateStr <= today;
    if (started) {
      weekTotal += 1;
      const lec = findLectureForOccurrence(slot, dateStr, scheduled, links);
      if (lec) weekWithNote += 1;
      else if (dateStr < today) pastWithoutNote.push({ slot, dateStr });
    }
  }

  function subjName(slot: ScheduleSlot) {
    const c = courses.find((x) => x.id === slot.subject);
    return c ? courseName(c) : "Предмет";
  }

  const percent = weekTotal > 0 ? Math.round((weekWithNote / weekTotal) * 100) : 0;

  return (
    <aside className="c-schedule-aside">
      {upcoming && (
        <div className="c-schedule-card">
          <span className="c-schedule-card-label">Следующая пара</span>
          <div className="c-schedule-next">
            <SubjectCover
              seed={courses.find((c) => c.id === upcoming.slot.subject)?.cover_seed}
              size={44}
            />
            <div>
              <div className="t">{subjName(upcoming.slot)}</div>
              <div className="m">
                Лекция
                {upcoming.dateStr === today ? ", сегодня" : ""}
                {(() => {
                  const start = pairTimes.find((p) => p.n === upcoming.slot.pair_number)?.start;
                  return start ? ` · ${start}` : "";
                })()}
                {upcoming.slot.room ? ` · ауд. ${upcoming.slot.room}` : ""}
              </div>
            </div>
          </div>
          {findLectureForOccurrence(upcoming.slot, upcoming.dateStr, scheduled, links) ? (
            <Button variant="soft" onClick={() => onStart(upcoming.slot, upcoming.dateStr)}>
              Открыть конспект
            </Button>
          ) : (
            <Button variant="soft" onClick={() => onStart(upcoming.slot, upcoming.dateStr)}>
              Начать конспект
            </Button>
          )}
        </div>
      )}

      <div className="c-schedule-card">
        <span className="c-schedule-card-label">Эта неделя</span>
        <div className="c-schedule-week-count">
          {weekWithNote} из {weekTotal} {pluralRu(weekTotal, ["пары", "пар", "пар"])} с конспектом
        </div>
        <div className="c-progress">
          <div className="c-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        {pastWithoutNote.length > 0 && (
          <>
            <div className="c-schedule-divider" />
            <span className="c-schedule-card-sub">Без конспекта</span>
            <div className="c-schedule-missing-list">
              {pastWithoutNote.slice(0, 5).map(({ slot, dateStr }) => (
                <button
                  key={slot.id + dateStr}
                  type="button"
                  className="c-schedule-missing-row"
                  onClick={() => onStart(slot, dateStr)}
                >
                  <span>
                    {subjName(slot)} · {DAY_NAMES[weekdayMon1(fromDateStr(dateStr)) - 1]}
                  </span>
                  <span className="c-schedule-missing-action">Начать</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

/* ---------- Пустое состояние (spec 4.6) ---------- */

function ScheduleEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon="cal"
      title="Расписание пока пустое"
      description="Добавь пары вручную — остальное подтянется из конспектов."
      action={<Button onClick={onAdd}>Добавить пару вручную</Button>}
    />
  );
}
