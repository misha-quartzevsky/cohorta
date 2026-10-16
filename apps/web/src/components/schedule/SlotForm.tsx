import { useEffect, useState } from "react";
import { Modal, Button, Input } from "../ui";
import { Select } from "../ui/Field";
import type { Course, ScheduleSlot, PairTime } from "../../lib/types";
import { courseName } from "../../lib/types";
import type { SlotInput } from "../../services/scheduleService";

const WEEKDAYS = [
  { n: 1, label: "Понедельник" },
  { n: 2, label: "Вторник" },
  { n: 3, label: "Среда" },
  { n: 4, label: "Четверг" },
  { n: 5, label: "Пятница" },
  { n: 6, label: "Суббота" },
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
  /** Предзаполнение для добавления из клетки сетки. */
  preset?: { weekday?: number; pair_number?: number; week_parity?: string };
  /** Редактируемый слот (режим правки). */
  slot?: ScheduleSlot | null;
  onSave: (input: SlotInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/** Форма пары (spec 4.4). Без confirm() — удаление подтверждается внутри. */
export default function SlotForm({
  open,
  onClose,
  courses,
  pairTimes,
  preset,
  slot,
  onSave,
  onDelete,
}: Props) {
  const [subject, setSubject] = useState(slot?.subject ?? courses[0]?.id ?? "");
  const [weekday, setWeekday] = useState(slot?.weekday ?? preset?.weekday ?? 1);
  const [pairNumber, setPairNumber] = useState(
    slot?.pair_number ?? preset?.pair_number ?? pairTimes[0]?.n ?? 1
  );
  const [parity, setParity] = useState<string>(
    slot?.week_parity ?? preset?.week_parity ?? "any"
  );
  const [kind, setKind] = useState<string>(slot?.kind ?? "lecture");
  const [room, setRoom] = useState(slot?.room ?? "");
  const [teacher, setTeacher] = useState(slot?.teacher ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Форма не размонтируется между открытиями (Modal просто скрывает
  // содержимое), поэтому useState-инициализация выше отрабатывает только
  // на первый показ. При каждом новом открытии перечитываем поля из
  // актуальных slot/preset — иначе второй клик по другой клетке подставляет
  // значения из первого открытия.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slot, preset]);

  if (courses.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title="Сначала добавь предмет">
        <p className="ds-body ds-muted">
          Чтобы поставить пару, нужен хотя бы один предмет.
        </p>
        <div className="ds-modal__footer">
          <Button variant="secondary" onClick={onClose}>
            Понятно
          </Button>
        </div>
      </Modal>
    );
  }

  async function handleSave() {
    if (!subject) return;
    setSaving(true);
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
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={slot ? "Изменить пару" : "Добавить пару"}
      footer={
        <>
          {slot && onDelete && (
            <div style={{ marginRight: "auto" }}>
              {confirmDelete ? (
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <span className="ds-caption">Удалить?</span>
                  <Button
                    variant="danger-text"
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
                <Button variant="danger-text" onClick={() => setConfirmDelete(true)}>
                  Удалить пару
                </Button>
              )}
            </div>
          )}
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            Сохранить
          </Button>
        </>
      }
    >
      <Select label="Предмет" value={subject} onChange={(e) => setSubject(e.target.value)}>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {courseName(c)}
          </option>
        ))}
      </Select>
      <Select
        label="День недели"
        value={String(weekday)}
        onChange={(e) => setWeekday(Number(e.target.value))}
      >
        {WEEKDAYS.map((d) => (
          <option key={d.n} value={d.n}>
            {d.label}
          </option>
        ))}
      </Select>
      <Select
        label="Номер пары"
        value={String(pairNumber)}
        onChange={(e) => setPairNumber(Number(e.target.value))}
      >
        {pairTimes.map((p) => (
          <option key={p.n} value={p.n}>
            {p.n} пара · {p.start}–{p.end}
          </option>
        ))}
      </Select>
      <Select label="Недели" value={parity} onChange={(e) => setParity(e.target.value)}>
        {PARITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>
      <Select label="Тип" value={kind} onChange={(e) => setKind(e.target.value)}>
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </Select>
      <Input label="Аудитория" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="214" />
      <Input
        label="Преподаватель"
        value={teacher}
        onChange={(e) => setTeacher(e.target.value)}
        placeholder="необязательно"
      />
    </Modal>
  );
}
