import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FormDialog, Input, SubjectCover } from "../../ui";
import { useSemester } from "../../lib/semesterContext";
import { pickActiveSemester } from "../../lib/activeSemester";
import { createCourse, fetchCourses } from "../../services/courseService";
import { courseSlug, semesterLabel, semesterSlug } from "../../lib/types";
import { nextCoverSeed } from "../../lib/coverSeed";
import { notifyLecturesChanged } from "../../lib/lecturesChanged";
import { errorMessage } from "../../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** «Новый предмет» (Screen-forms-create, Screen-m-form-subject): только название, период — текущий. */
export default function SubjectFormDialog({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { semesters } = useSemester();
  const semester = useMemo(() => pickActiveSemester(semesters), [semesters]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setName("");
    setError("");
    void fetchCourses()
      .then((all) => setCount(all.length))
      .catch(() => setCount(0));
  }, [open]);

  if (!semester) {
    return (
      <FormDialog open={open} onClose={onClose} title="Новый предмет" submitLabel="Создать" onSubmit={() => false}>
        <div className="c-form-notice">
          <strong>Сначала добавь период</strong>
          <p>Предмет попадает в текущий период. Периоды учёбы настраиваются в профиле.</p>
          <Link to="/settings/periods" className="c-btn secondary" onClick={onClose}>
            Перейти к периодам
          </Link>
        </div>
      </FormDialog>
    );
  }

  async function submit() {
    const title = name.trim();
    if (!title) {
      setError("Введи название предмета");
      return false;
    }
    try {
      const course = await createCourse(title, undefined, semester!.id);
      notifyLecturesChanged();
      navigate(`/s/${semesterSlug(semester!)}/${courseSlug(course)}`);
    } catch (e) {
      setError("Не удалось создать предмет: " + errorMessage(e));
      return false;
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Новый предмет"
      subtitle={`Только название. Предмет попадёт в текущий период, ${semesterLabel(semester)}. Обложка создаётся сама.`}
      subtitleDesktopOnly
      submitLabel="Создать"
      onSubmit={submit}
    >
      <Input
        label="Название"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError("");
        }}
        placeholder="Например, Гражданское право"
        error={error || undefined}
        autoFocus
      />
      <div className="c-form-cover">
        <SubjectCover seed={nextCoverSeed(count)} size={44} />
        <span className="c-form-d">Так будет выглядеть обложка. Она не меняется, даже если переименуешь предмет.</span>
        <span className="c-form-m">
          Обложка создаётся сама. Предмет попадёт в текущий период, {semesterLabel(semester)}.
        </span>
      </div>
    </FormDialog>
  );
}
