import { useEffect, useMemo, useState } from "react";
import { Modal, Button, FormDialog, Segmented, Icon } from "../../ui";
import { Input, Select } from "../../ui/Field";
import type { Course, ScheduleSlot, PairTime } from "../../lib/types";
import { courseName } from "../../lib/types";
import type { SlotInput } from "../../services/scheduleService";
import { findSlotConflict, parityPhrase } from "../../lib/slotConflict";

const WEEKDAYS = [
  { value: "1", label: "Пн", full: "Понедельник" },
  { value: "2", label: "Вт", full: "Вторник" },
  { value: "3", label: "Ср", full: "Среда" },
  { value: "4", label: "Чт", full: "Четверг" },
  { value: "5", label: "Пт", full: "Пятница" },
  { value: "6", label: "Сб", full: "Суббота" },
];

const KINDS = [
  { value: "lecture", label: "Лекция" },
  { value: "seminar", label: "Семинар" },
  { value: "lab", label: "Лаб." },
  { value: "other", label: "Другое" },
];

const PARITIES = [
  { value: "any", label: "Каждая" },
  { value: "odd", label: "Нечётные" },
  { value: "even", label: "Чётные" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  courses: Course[];
  pairTimes: PairTime[];
  /** Все пары расписания: по ним ищется занятая клетка. */
  slots: ScheduleSlot[];
  /** Предзаполнение для добавления из клетки сетки. */
  preset?: { weekday?: number; pair_number?: number; week_parity?: string };
  /** Редактируемый слот (режим правки). */
  slot?: ScheduleSlot | null;
  onSave: (input: SlotInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  /** Открыть «Новый предмет», когда предметов ещё нет. */
  onAddSubject?: () => void;
}

/** Форма пары (Screen-forms-create, Screen-m-form-pair; spec 4.4). Занятая клетка — текст под «Недели», сохранить нельзя. */
export default function SlotFormNew({
  open,
  onClose,
  courses,
  pairTimes,
  slots,
  preset,
  slot,
  onSave,
  onDelete,
  onAddSubject,
}: Props) {
  const [subject, setSubject] = useState(slot?.subject ?? courses[0]?.id ?? "");
  const [weekday, setWeekday] = useState(slot?.weekday ?? preset?.weekday ?? 1);
  const [pairNumber, setPairNumber] = useState(
    slot?.pair_number ?? preset?.pair_number ?? pairTimes[0]?.n ?? 1
  );
  const [parity, setParity] = useState<string>(slot?.week_parity ?? preset?.week_parity ?? "any");
  const [kind, setKind] = useState<string>(slot?.kind ?? "lecture");
  const [room, setRoom] = useState(slot?.room ?? "");
  const [teacher, setTeacher] = useState(slot?.teacher ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Занятая клетка показывается, когда человек сам выбрал время или нажал «Сохранить»,
  // а не в первую секунду после открытия.
  const [touched, setTouched] = useState(false);

  // Modal не размонтирует содержимое между открытиями — перечитываем поля
  // из актуальных slot/preset при каждом новом открытии.
  useEffect(() => {
    if (!open) return;
    setSubject(slot?.subject ?? courses[0]?.id ?? "");
    setWeekday(slot?.weekday ?? preset?.weekday ?? 1);
    setPairNumber(slot?.pair_number ?? preset?.pair_number ?? pairTimes[0]?.n ?? 1);
    setParity(slot?.week_parity ?? preset?.week_parity ?? "any");
    setKind(slot?.kind ?? "lecture");
    setRoom(slot?.room ?? "");
    setTeacher(slot?.teacher ?? "");
    setConfirmDelete(false);
    setSaveError("");
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slot, preset]);

  // Предметы могут догрузиться после открытия формы (?add=1 с Главной) — подставляем первый.
  useEffect(() => {
    if (open && !subject && courses[0]) setSubject(courses[0].id);
  }, [open, subject, courses]);

  const conflict = useMemo(
    () => findSlotConflict(slots, { weekday, pair_number: pairNumber, week_parity: parity }, slot?.id),
    [slots, weekday, pairNumber, parity, slot?.id]
  );
  const conflictCourse = conflict
    ? (conflict.expand?.subject ?? courses.find((c) => c.id === conflict.subject))
    : undefined;
  const conflictText = conflict && touched
    ? `В это время уже есть пара «${conflictCourse ? courseName(conflictCourse) : "другого предмета"}» ${parityPhrase(
        conflict.week_parity ?? "any"
      )}. Выбери другую неделю или номер пары.`
    : "";

  if (courses.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title="Новая пара">
        <div className="c-form-notice">
          <strong>Сначала добавь предмет</strong>
          <p>Пара привязана к предмету. Без него её некуда поставить.</p>
          {onAddSubject && (
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                onAddSubject();
              }}
            >
              <Icon name="plus" size={16} />
              Добавить предмет
            </Button>
          )}
        </div>
      </Modal>
    );
  }

  async function submit() {
    if (!subject) return false;
    if (conflict) {
      setTouched(true);
      return false;
    }
    try {
      await onSave({
        subject,
        weekday,
        pair_number: pairNumber,
        week_parity: parity,
        kind,
        room: room.trim(),
        teacher: teacher.trim(),
      });
    } catch {
      setSaveError("Не удалось сохранить пару. Попробуй ещё раз.");
      return false;
    }
  }

  const hasPairTime = pairTimes.some((p) => p.n === pairNumber);
  const weekdayFull = WEEKDAYS.find((d) => d.value === String(weekday))?.full ?? "";

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={slot ? "Пара" : "Новая пара"}
      subtitle={slot ? `${weekdayFull}, ${pairNumber} пара. Правка.` : "Выбери клетку в сетке или заполни здесь."}
      submitLabel="Сохранить"
      onSubmit={submit}
      leading={
        slot && onDelete ? (
          confirmDelete ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Удалить?</span>
              <Button
                variant="danger"
                onClick={async () => {
                  await onDelete();
                  onClose();
                }}
              >
                Да
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Нет
              </Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Удалить пару
            </Button>
          )
        ) : undefined
      }
    >
      <Select label="Предмет" value={subject} onChange={(e) => setSubject(e.target.value)}>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {courseName(c)}
          </option>
        ))}
      </Select>
      <div className="c-form-seg">
        <label>День недели</label>
        <Segmented
          aria-label="День недели"
          value={String(weekday)}
          onChange={(v) => {
            setTouched(true);
            setWeekday(Number(v));
          }}
          options={WEEKDAYS.map((d) => ({ value: d.value, label: d.label }))}
        />
      </div>
      <Select label="Пара" value={String(pairNumber)} onChange={(e) => {
          setTouched(true);
          setPairNumber(Number(e.target.value));
        }}>
        {pairTimes.map((p) => (
          <option key={p.n} value={p.n}>
            {p.n} пара · {p.start}–{p.end}
          </option>
        ))}
        {!hasPairTime && <option value={pairNumber}>{pairNumber} пара</option>}
      </Select>
      <div className="c-form-seg">
        <label>Недели</label>
        <Segmented aria-label="Недели" value={parity} onChange={(v) => {
            setTouched(true);
            setParity(v);
          }} options={PARITIES} />
        {conflictText && (
          <p className="c-form-err" role="alert">
            {conflictText}
          </p>
        )}
      </div>
      <div className="c-form-seg">
        <label>Тип</label>
        <Segmented aria-label="Тип" value={kind} onChange={setKind} options={KINDS} />
      </div>
      <div className="c-form-two">
        <Input label="Аудитория" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="214" />
        <Input
          label="Преподаватель"
          value={teacher}
          onChange={(e) => setTeacher(e.target.value)}
          placeholder="Необязательно"
        />
      </div>
      {saveError && (
        <p className="c-form-err" role="alert">
          {saveError}
        </p>
      )}
    </FormDialog>
  );
}
