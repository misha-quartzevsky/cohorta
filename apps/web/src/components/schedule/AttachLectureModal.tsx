import { useState } from "react";
import { Modal, List, ListRow, EmptyState } from "../../ui";
import type { Lecture } from "../../lib/types";
import { lectureTitle } from "../../lib/types";

function formatDateRu(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Лекции предмета, которому принадлежит пара (уже загружены вызывающим). */
  lectures: Lecture[];
  onAttach: (lectureId: string) => Promise<void>;
}

/**
 * «Добавить конспект» (B3, 2026-10-19) — прикрепить уже существующую
 * лекцию предмета к пустой паре на конкретную дату (schedule_slot_lectures).
 * Та же дизайн-основа, что у формы пары (.c-dialog). Одна и та же лекция
 * может быть прикреплена к нескольким разным парам/датам — список не
 * исключает уже где-то прикреплённые лекции.
 */
export default function AttachLectureModal({ open, onClose, lectures, onAttach }: Props) {
  const [attachingId, setAttachingId] = useState<string | null>(null);

  async function handlePick(id: string) {
    setAttachingId(id);
    try {
      await onAttach(id);
      onClose();
    } finally {
      setAttachingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Добавить конспект">
      {lectures.length === 0 ? (
        <EmptyState
          icon="doc"
          title="У предмета пока нет лекций"
          description="Сначала создай хотя бы одну через «Начать конспект»."
        />
      ) : (
        <List>
          {lectures.map((l) => (
            <ListRow
              key={l.id}
              title={lectureTitle(l)}
              meta={
                [l.number ? `Лекция ${l.number}` : null, formatDateRu(l.lecture_date) || null]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
              onClick={() => void handlePick(l.id)}
              right={
                attachingId === l.id ? (
                  <span className="c-attach-lecture-status">Добавляю…</span>
                ) : undefined
              }
            />
          ))}
        </List>
      )}
    </Modal>
  );
}
