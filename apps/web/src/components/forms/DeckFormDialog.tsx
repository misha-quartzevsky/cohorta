import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormDialog, Input, Select } from "../../ui";
import { createDeck, DECK_SUBJECT_SUPPORTED } from "../../services/deckService";
import { fetchCourses } from "../../services/courseService";
import type { Course } from "../../lib/types";
import { courseName } from "../../lib/types";
import { errorMessage } from "../../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Предмет, откуда открыли форму (подставляется, но его можно сменить). */
  defaultSubjectId?: string;
}

/** «Новая колода» (Screen-forms-create): название и необязательный предмет. */
export default function DeckFormDialog({ open, onClose, defaultSubjectId }: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(defaultSubjectId ?? "");
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setError("");
    setSubject(defaultSubjectId ?? "");
    if (DECK_SUBJECT_SUPPORTED) void fetchCourses().then(setCourses).catch(() => setCourses([]));
  }, [open, defaultSubjectId]);

  async function submit() {
    const name = title.trim();
    if (!name) {
      setError("Введи название колоды");
      return false;
    }
    try {
      const deck = await createDeck({ title: name, subject: subject || undefined });
      navigate(`/decks/${deck.slug ?? deck.id}`);
    } catch (e) {
      setError("Не удалось создать колоду: " + errorMessage(e));
      return false;
    }
  }

  return (
    <FormDialog open={open} onClose={onClose} title="Новая колода" submitLabel="Создать" onSubmit={submit}>
      <Input
        label="Название"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setError("");
        }}
        placeholder="Например, Сделки и договоры"
        error={error || undefined}
        autoFocus
      />
      {DECK_SUBJECT_SUPPORTED && (
        <Select
          label="Предмет"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          hint="Колода лежит в предмете. Выбран тот, откуда ты пришла."
        >
          <option value="">Без предмета</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {courseName(c)}
            </option>
          ))}
        </Select>
      )}
    </FormDialog>
  );
}
