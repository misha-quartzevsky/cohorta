import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button, Icon, SubjectCover } from "../../ui";
import LecturePickerDialog from "./LecturePickerDialog";
import type { Course, Lecture } from "../../lib/types";
import { courseName, lectureTitle } from "../../lib/types";
import { fetchLecturesOpenedToMe } from "../../services/examService";

interface Props {
  lectures: Lecture[];
  selectedIds: string[];
  onChange: (next: string[]) => void | Promise<void>;
  course: Course | null;
  ticketNumber: number;
}

/**
 * «Связанные лекции» (spec раздел 8) — Screen-ticket.dc.html, правая панель.
 * «Привязать лекцию» открывает окно выбора (Screen-ticket-lecture-picker).
 * Лекция, доступ к которой закрыли, остаётся строкой «Лекция недоступна» с кнопкой убрать.
 */
export default function TicketSourcesPanel({ lectures, selectedIds, onChange, course, ticketNumber }: Props) {
  const [picking, setPicking] = useState(false);
  const [opened, setOpened] = useState<Lecture[]>([]);

  useEffect(() => {
    void fetchLecturesOpenedToMe()
      .then(setOpened)
      .catch(() => setOpened([]));
  }, []);

  const rows = useMemo(
    () =>
      selectedIds.map((id) => {
        const mine = lectures.find((l) => l.id === id);
        if (mine) return { id, lecture: mine, course };
        const other = opened.find((l) => l.id === id);
        return { id, lecture: other, course: other?.expand?.field ?? null };
      }),
    [selectedIds, lectures, opened, course]
  );

  function remove(id: string) {
    void onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className="c-exam-card c-ticket-aside c-exam-card-pad">
      <h2>Связанные лекции</h2>
      <div className="list" style={{ marginTop: 6 }}>
        {rows.map(({ id, lecture: l, course: c }) => (
          <div key={id} className="c-ticket-source-row">
            {l ? <SubjectCover seed={c?.cover_seed} size={36} /> : <SubjectCover size={36} />}
            <div className="c-ticket-source-tx">
              <span className="t">{l ? lectureTitle(l) : "Лекция недоступна"}</span>
              {l && (
                <span className="m">
                  {l.number ? `Лекция ${l.number}` : "Лекция"}
                  {c ? ` · ${courseName(c)}` : ""}
                </span>
              )}
            </div>
            <button
              type="button"
              className="c-ticket-source-remove"
              aria-label={l ? `Отвязать «${lectureTitle(l)}»` : "Убрать недоступную лекцию"}
              onClick={() => remove(id)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div className="c-ticket-source-pick">
        <Button variant="secondary" onClick={() => setPicking(true)}>
          <Icon name="plus" size={18} />
          Привязать лекцию
        </Button>
      </div>
      <LecturePickerDialog
        open={picking}
        onClose={() => setPicking(false)}
        ticketNumber={ticketNumber}
        mine={lectures}
        course={course}
        opened={opened}
        selectedIds={selectedIds}
        onSave={async (ids) => {
          await onChange(ids);
        }}
      />
    </div>
  );
}
