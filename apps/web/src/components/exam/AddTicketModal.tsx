import { useEffect, useState } from "react";
import { FormDialog, Input, Textarea } from "../../ui";
import { errorMessage } from "../../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (question: string, answer: string) => Promise<void>;
  /** «Вставить список билетов сразу» — переход на экран импорта. */
  onImportList: () => void;
}

/**
 * «Добавить билет» (Screen-forms-create, раздел «Билеты экзамена»; Screen-m-ticket-add): название и
 * необязательный ответ, номер назначается сам. Один диалог для соло и для группы: меняется только то,
 * куда сохраняется (`onCreate`) и куда ведёт «Вставить список билетов сразу» (`onImportList`).
 *
 * Десктоп: ссылка отдельной строкой слева под «Ответом», над кнопками «Отмена» и «Добавить» (справа).
 * Телефон: шторка, ссылка под кнопкой «Добавить» (стили `.c-form-lead:has(.c-form-link)`).
 */
export default function AddTicketModal({ open, onClose, onCreate, onImportList }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setQuestion("");
      setAnswer("");
      setError("");
    }
  }, [open]);

  async function submit() {
    const q = question.trim();
    if (!q) {
      setError("Введи название билета");
      return false;
    }
    try {
      await onCreate(q, answer.trim());
    } catch (e) {
      setError("Не удалось добавить билет: " + errorMessage(e));
      return false;
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Добавить билет"
      submitLabel="Добавить"
      onSubmit={submit}
      leading={
        <button
          type="button"
          className="c-form-link c-form-m"
          onClick={() => {
            onClose();
            onImportList();
          }}
        >
          Вставить список билетов сразу
        </button>
      }
    >
      <Input
        label="Название билета"
        value={question}
        onChange={(e) => {
          setQuestion(e.target.value);
          setError("");
        }}
        placeholder="Например, Виды сделок"
        error={error || undefined}
        autoFocus
      />
      <Textarea
        label="Ответ · необязательно"
        placeholder="Можно добавить позже"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
      />
      <button
        type="button"
        className="c-form-link c-form-d c-form-link-row"
        onClick={() => {
          onClose();
          onImportList();
        }}
      >
        Вставить список билетов сразу
      </button>
    </FormDialog>
  );
}
