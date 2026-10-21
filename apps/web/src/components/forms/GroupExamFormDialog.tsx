import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, DateField, FormDialog, Select } from "../../ui";
import { fetchCourses } from "../../services/courseService";
import { createExam, fetchExamsForCourses } from "../../services/examService";
import { courseName } from "../../lib/types";
import type { Course } from "../../lib/types";
import { errorMessage } from "../../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: string;
  semSlug: string;
  /** Окно «Новый предмет», если предметов ещё нет. */
  onAddSubject: () => void;
}

/**
 * «Новый экзамен группы» (Screen-forms-create; телефонного макета нет, на телефоне та же шторка, что у Screen-m-form-exam):
 * предмет и необязательная дата. Подгруппы создаются потом, на экране экзамена.
 * Экзамен создаёт любой участник группы. Один экзамен на предмет у человека: предметы, у которых
 * экзамен уже есть, в списке не показываются.
 */
export default function GroupExamFormDialog({ open, onClose, groupId, semSlug, onAddSubject }: Props) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [dateValid, setDateValid] = useState(true);
  const [dateError, setDateError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate("");
    setDateValid(true);
    setDateError("");
    setError("");
    setCourses(null);
    void (async () => {
      try {
        const all = await fetchCourses();
        const taken = new Set((await fetchExamsForCourses(all.map((c) => c.id))).map((e) => String(e.course)));
        const free = all.filter((c) => !taken.has(c.id));
        setCourses(free);
        setSubject(free[0]?.id ?? "");
      } catch {
        setCourses([]);
      }
    })();
  }, [open]);

  if (courses && courses.length === 0) {
    return (
      <FormDialog open={open} onClose={onClose} title="Новый экзамен группы" submitLabel="Создать экзамен" onSubmit={() => false}>
        <div className="c-form-notice">
          <strong>Сначала добавь предмет</strong>
          <p>Экзамен привязан к предмету. Без него некуда поставить.</p>
          <Button
            variant="secondary"
            onClick={() => {
              onClose();
              onAddSubject();
            }}
          >
            Добавить предмет
          </Button>
        </div>
      </FormDialog>
    );
  }

  async function submit() {
    const course = courses?.find((c) => c.id === subject);
    if (!course) {
      setError("Выбери предмет");
      return false;
    }
    if (!dateValid) {
      setDateError("Введи дату как 25.01.2027 или оставь поле пустым");
      return false;
    }
    try {
      const exam = await createExam({ courseId: course.id, examDate: date, groupId });
      navigate(`/s/${semSlug}/group/exams/${exam.id}`);
    } catch (e) {
      setError("Не удалось создать экзамен: " + errorMessage(e));
      return false;
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Новый экзамен группы"
      subtitle="Подгруппы создашь после. Создать экзамен может любой участник."
      submitLabel="Создать экзамен"
      onSubmit={submit}
    >
      <Select label="Предмет" value={subject} onChange={(e) => setSubject(e.target.value)} error={error || undefined}>
        {(courses ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {courseName(c)}
          </option>
        ))}
      </Select>
      <DateField
        label="Дата экзамена · необязательно"
        value={date}
        onChange={(iso, valid) => {
          setDate(iso);
          setDateValid(valid);
          setDateError("");
        }}
        error={dateError || undefined}
      />
    </FormDialog>
  );
}
