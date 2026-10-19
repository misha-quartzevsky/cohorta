import { useEffect, useState } from "react";
import { Modal, Button } from "../../ui";
import { Textarea } from "../../ui/Field";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Следующий свободный номер билета (подставляется в форму, не редактируется). */
  nextNumber: number;
  onCreate: (question: string) => Promise<void>;
}

/**
 * «Добавить билет» (Screen-m-exam.dc.html) — ручное добавление ОДНОГО
 * билета, в отличие от «Импорт» (вставка целого списка). В макете нет
 * формы для этого действия — минимальная карточка по образцу остальных
 * модалок (SlotFormNew): один билет, номер назначается автоматически.
 */
export default function AddTicketModal({ open, onClose, nextNumber, onCreate }: Props) {
  const [question, setQuestion] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setQuestion("");
  }, [open]);

  async function handleSave() {
    const trimmed = question.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onCreate(trimmed);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Добавить билет ${nextNumber}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            loading={saving}
            disabled={!question.trim()}
          >
            Добавить
          </Button>
        </>
      }
    >
      <Textarea
        label="Текст билета"
        placeholder="Вопрос билета…"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        autoFocus
      />
    </Modal>
  );
}
