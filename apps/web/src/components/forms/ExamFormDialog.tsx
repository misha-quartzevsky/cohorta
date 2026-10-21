import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, DateField, FormDialog, Select } from "../../ui";
import { useSemester } from "../../lib/semesterContext";
import { fetchCourses } from "../../services/courseService";
import { createExam, fetchExamsForCourses } from "../../services/examService";
import { courseName, courseSemesterId, courseSlug, semesterSlug } from "../../lib/types";
import type { Course } from "../../lib/types";
import { errorMessage } from "../../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Предмет, откуда открыли форму (подставляется, но его можно сменить). */
  defaultSubjectId?: string;
  /** Окно «Новый предмет», если предметов ещё нет. */
  onAddSubject: () => void;
}

/**
 * «Новый экзамен» (Screen-forms-create, Screen-m-form-exam): предмет и
 * необязательная дата. Один экзамен на предмет — предметы, у которых он уже
 * есть, в списке не показываются. Строка про экзамен группы появится в волне C.
 */
export default function ExamFormDialog({ open, onClose, defaultSubjectId, onAddSubject }: Props) {
  const navigate = useNavigate();
  const { semesters } = useSemester();
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
        setSubject(free.find((c) => c.id === defaultSubjectId)?.id ?? free[0]?.id ?? "");
      } catch {
        setCourses([]);
      }
    })();
  }, [open, defaultSubjectId]);

  if (courses && courses.length === 0) {
    return (
      <FormDialog open={open} onClose={onClose} title="Новый экзамен" submitLabel="Создать экзамен" onSubmit={() => false}>
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
      await createExam({ courseId: course.id, examDate: date });
      const sem = semesters.find((s) => s.id === courseSemesterId(course));
      navigate(`/s/${sem ? semesterSlug(sem) : ""}/${courseSlug(course)}/exam`);
    } catch (e) {
      setError("Не удалось создать экзамен: " + errorMessage(e));
      return false;
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Новый экзамен"
      subtitle="Один экзамен на предмет."
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
        hint="Нужна для обратного отсчёта на главной."
      />
    </FormDialog>
  );
}
