/**
 * ============================================
 *  SubjectPairsPage.tsx — «Пары предмета» (B3, 2026-10-20)
 * ============================================
 *
 * Вёрстка 1:1 по docs/design/screens/Screen-subject-pairs(-m).dc.html.
 * Маршрут `/s/:semesterSlug/:courseSlug/pairs` — новый (решение по
 * умолчанию, спецификация адрес не называет), вход — пункт «Пары
 * предмета» в меню слота на /schedule (components/schedule/…SlotCard
 * в pages/SchedulePageNew.tsx). Записано в docs/decisions.md.
 *
 * Вкладки «Лекции N / Пары N / Экзамен» в мокапе — те же разделы,
 * что уже существуют отдельными страницами (курс, экзамен); здесь они
 * просто ведут на них, повторная реализация не нужна.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, MoreHorizontal } from "lucide-react";

import { Button, Icon, Pills, StatusChip, Menu } from "../ui";
import SlotFormNew from "../components/schedule/SlotFormNew";
import AttachLectureModal from "../components/schedule/AttachLectureModal";
import { useCourseBySlug } from "../hooks/useCourseBySlug";
import { useSchedule } from "../hooks/useSchedule";
import { useSemester } from "../lib/semesterContext";
import {
  fetchLecturesOfSubject,
  fetchSlotLectureLinks,
  createSlotLectureLink,
  startNoteForSlot,
  type SlotInput,
} from "../services/scheduleService";
import { courseName, courseSlug, semesterSlug } from "../lib/types";
import type { Lecture, ScheduleSlot, ScheduleSlotLecture } from "../lib/types";
import { pickActiveSemester } from "../lib/activeSemester";
import { mondayOf, fromDateStr, toDateStr, addDays, todayStr } from "../lib/localDate";
import { getWeekParity, slotMatchesParity, dateForWeekday, findLectureForOccurrence } from "../lib/weekParity";

const DAY_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

function parityLabel(parity?: string): string {
  if (parity === "odd") return "нечётные недели";
  if (parity === "even") return "чётные недели";
  return "каждую неделю";
}

function kindLabel(kind?: string): string {
  if (kind === "seminar") return "Семинар";
  if (kind === "lab") return "Лаб.";
  if (kind === "other") return "Пара";
  return "Лекция";
}

export default function SubjectPairsPage() {
  const navigate = useNavigate();
  const { courseSlug: courseSlugParam } = useParams();
  const { course } = useCourseBySlug(courseSlugParam ?? "");
  const { semesters } = useSemester();
  const activeSemester = useMemo(() => pickActiveSemester(semesters), [semesters]);
  const semSlug = activeSemester ? semesterSlug(activeSemester) : "";

  const { settings, slots, createSlot, updateSlot, deleteSlot } = useSchedule(activeSemester?.id);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [lectureCount, setLectureCount] = useState(0);
  const [links, setLinks] = useState<ScheduleSlotLecture[]>([]);
  const reloadLinks = () => fetchSlotLectureLinks().then(setLinks).catch(() => {});

  useEffect(() => {
    if (!course) return;
    void fetchLecturesOfSubject(course.id).then((ls) => {
      setLectures(ls);
      setLectureCount(ls.length);
    });
    void reloadLinks();
  }, [course]);

  // «Добавить конспект»: прикрепить существующую лекцию предмета к пустой
  // паре на её ближайшую дату (см. pages/SchedulePageNew.tsx).
  const [attachTarget, setAttachTarget] = useState<{ slot: ScheduleSlot; dateStr: string } | null>(
    null
  );
  async function handleAttach(lectureId: string) {
    if (!attachTarget) return;
    await createSlotLectureLink(attachTarget.slot.id, lectureId, attachTarget.dateStr);
    await reloadLinks();
  }

  const subjectSlots = slots
    .filter((s) => s.subject === course?.id)
    .sort((a, b) => a.weekday - b.weekday || a.pair_number - b.pair_number);

  const anchor = settings?.odd_week_anchor ? fromDateStr(settings.odd_week_anchor) : mondayOf(new Date());
  const today = todayStr();

  const [formOpen, setFormOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<ScheduleSlot | null>(null);

  function nextOccurrenceDate(slot: ScheduleSlot): string {
    // Ближайшая дата этой пары (сегодня или позже, с учётом чётности) —
    // для статуса «конспект есть/нет» в строке (без привязки к неделе
    // расписания: страница вне контекста конкретной недели).
    for (let i = 0; i < 14; i++) {
      const d = addDays(fromDateStr(today), i);
      const parity = getWeekParity(d, anchor);
      if (weekdayOf(d) === slot.weekday && slotMatchesParity(slot.week_parity, parity)) {
        return toDateStr(d);
      }
    }
    return dateForWeekday(mondayOf(new Date()), slot.weekday);
  }

  function weekdayOf(d: Date): number {
    return ((d.getDay() + 6) % 7) + 1;
  }

  async function handleStartNote(slot: ScheduleSlot) {
    const dateStr = nextOccurrenceDate(slot);
    const lecture = await startNoteForSlot(slot, dateStr, lectures);
    if (course) {
      navigate(`/s/${semSlug}/${courseSlug(course)}/${lecture.slug ?? lecture.id}/edit`);
    }
  }

  function openExistingNote(slot: ScheduleSlot, dateStr: string) {
    const lecture = findLectureForOccurrence(slot, dateStr, lectures, links);
    if (lecture && course) {
      navigate(`/s/${semSlug}/${courseSlug(course)}/${lecture.slug ?? lecture.id}`);
    }
  }

  async function handleSave(input: SlotInput) {
    const payload = { ...input, subject: course?.id ?? input.subject, semester: activeSemester?.id };
    if (editSlot) await updateSlot(editSlot.id, payload);
    else await createSlot(payload);
    setEditSlot(null);
  }

  if (!course) return null;

  return (
    <div className="c-pairs">
      <div className="c-pairs-crumb">
        <span>{courseName(course)}</span>
        <Icon name="chev" size={14} />
        <span className="current">Пары</span>
      </div>

      <div className="c-pairs-m-crumb">
        <button type="button" onClick={() => navigate(`/s/${semSlug}/${courseSlug(course)}`)}>
          <ChevronLeft size={18} aria-hidden="true" />
          {courseName(course)}
        </button>
      </div>

      <div className="c-pairs-head">
        <div className="c-pairs-head-tx">
          <h1>Пары: {courseName(course)}</h1>
          <span>
            {subjectSlots.length} {subjectSlots.length === 1 ? "пара" : "пары"} в неделю
            {activeSemester ? ` · ${(activeSemester.label ?? "семестр").toLowerCase()}` : ""}
          </span>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditSlot(null);
            setFormOpen(true);
          }}
        >
          <Icon name="plus" size={18} />
          Добавить пару
        </Button>
      </div>

      <div className="c-pairs-m-head">
        <h1>Пары</h1>
        <span>
          {subjectSlots.length} {subjectSlots.length === 1 ? "пара" : "пары"} в неделю
          {activeSemester ? ` · ${(activeSemester.label ?? "семестр").toLowerCase()}` : ""}
        </span>
      </div>

      <Button
        variant="primary"
        className="c-pairs-m-add"
        onClick={() => {
          setEditSlot(null);
          setFormOpen(true);
        }}
      >
        <Icon name="plus" size={18} />
        Добавить пару
      </Button>

      <Pills
        aria-label="Раздел предмета"
        value="pairs"
        onChange={(v) => {
          if (v === "lectures") navigate(`/s/${semSlug}/${courseSlug(course)}`);
          if (v === "exam") navigate(`/s/${semSlug}/${courseSlug(course)}/exam`);
        }}
        options={[
          { value: "lectures", label: "Лекции", count: lectureCount },
          { value: "pairs", label: "Пары", count: subjectSlots.length },
          { value: "exam", label: "Экзамен" },
        ]}
      />

      {subjectSlots.length === 0 ? (
        <p className="c-pairs-empty">У этого предмета пока нет пар в расписании.</p>
      ) : (
        <>
          {/* Десктоп: день+время отдельной колонкой от типа+аудитории. */}
          <div className="c-pairs-list">
            {subjectSlots.map((slot) => {
              const dateStr = nextOccurrenceDate(slot);
              const hasNote = !!findLectureForOccurrence(slot, dateStr, lectures, links);
              const start = settings?.pair_times?.find((p) => p.n === slot.pair_number)?.start ?? "";
              return (
                <div key={slot.id} className="c-pairs-row">
                  <div className="c-pairs-row-day">
                    <span className="t">{DAY_FULL[slot.weekday - 1]}</span>
                    <span className="m">
                      {start}
                      {start ? " · " : ""}
                      {slot.pair_number} пара
                    </span>
                  </div>
                  <div className="c-pairs-row-kind">
                    <span className="t">{kindLabel(slot.kind)}</span>
                    <span className="m">
                      {slot.room ? `Ауд. ${slot.room} · ` : ""}
                      {parityLabel(slot.week_parity)}
                    </span>
                  </div>
                  <StatusChip tone={hasNote ? "ok" : "neutral"}>
                    {hasNote ? "Конспект есть" : "Конспекта нет"}
                  </StatusChip>
                  <PairRowMenu
                    hasNote={hasNote}
                    onOpen={() => openExistingNote(slot, dateStr)}
                    onStart={() => void handleStartNote(slot)}
                    onAttach={() => setAttachTarget({ slot, dateStr })}
                    onEdit={() => {
                      setEditSlot(slot);
                      setFormOpen(true);
                    }}
                    onDelete={() => void deleteSlot(slot.id)}
                  />
                </div>
              );
            })}
          </div>

          {/* Телефон: день+время и тип+аудитория каждый одной строкой,
              статус-чип отдельной строкой ниже (Screen-m-subject-pairs.dc.html). */}
          <div className="c-pairs-m-list">
            {subjectSlots.map((slot) => {
              const dateStr = nextOccurrenceDate(slot);
              const hasNote = !!findLectureForOccurrence(slot, dateStr, lectures, links);
              const start = settings?.pair_times?.find((p) => p.n === slot.pair_number)?.start ?? "";
              return (
                <div key={slot.id} className="c-pairs-m-row">
                  <div className="c-pairs-m-row-tx">
                    <span className="t">
                      {DAY_FULL[slot.weekday - 1]}
                      {start ? ` · ${start}` : ""}
                    </span>
                    <span className="m">
                      {kindLabel(slot.kind)}
                      {slot.room ? ` · ауд. ${slot.room} · ` : " · "}
                      {parityLabel(slot.week_parity)}
                    </span>
                    <StatusChip tone={hasNote ? "ok" : "neutral"}>
                      {hasNote ? "Конспект есть" : "Конспекта нет"}
                    </StatusChip>
                  </div>
                  <PairRowMenu
                    hasNote={hasNote}
                    onOpen={() => openExistingNote(slot, dateStr)}
                    onStart={() => void handleStartNote(slot)}
                    onAttach={() => setAttachTarget({ slot, dateStr })}
                    onEdit={() => {
                      setEditSlot(slot);
                      setFormOpen(true);
                    }}
                    onDelete={() => void deleteSlot(slot.id)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="c-pairs-note">
        <strong>Лекция создаётся сама</strong>
        <p>
          В день пары на главной появляется кнопка «Начать конспект». Повторное нажатие откроет
          ту же лекцию, а не создаст вторую.
        </p>
      </div>

      <SlotFormNew
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditSlot(null);
        }}
        courses={course ? [course] : []}
        pairTimes={settings?.pair_times ?? []}
        slots={slots}
        slot={editSlot}
        onSave={handleSave}
        onDelete={editSlot ? () => deleteSlot(editSlot.id) : undefined}
      />

      <AttachLectureModal
        open={!!attachTarget}
        onClose={() => setAttachTarget(null)}
        lectures={lectures}
        onAttach={handleAttach}
      />
    </div>
  );
}

function PairRowMenu({
  hasNote,
  onOpen,
  onStart,
  onAttach,
  onEdit,
  onDelete,
}: {
  hasNote: boolean;
  onOpen: () => void;
  onStart: () => void;
  onAttach: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
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
          <MoreHorizontal size={18} />
        </button>
      )}
      items={[
        hasNote
          ? { label: "Открыть конспект", onClick: onOpen }
          : { label: "Начать конспект", onClick: onStart },
        ...(hasNote ? [] : [{ label: "Добавить конспект", onClick: onAttach }]),
        { label: "Изменить пару", onClick: onEdit },
        { label: "Удалить пару", onClick: onDelete, danger: true },
      ]}
    />
  );
}
