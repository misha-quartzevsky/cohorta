import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLectures } from "../hooks/useLectures";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useSemester } from "../lib/semesterContext";
import {
  courseName,
  courseSlug,
  courseSemesterId,
  lectureSlug,
  lectureTitle,
  semesterSlug,
} from "../lib/types";
import Header from "../components/Header";
import LectureTile from "../components/LectureTile";
import AddTile from "../components/AddTile";
import LectureEditor from "../components/LectureEditor";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";

/**
 * Lectures page — все лекции курса в виде плиток + плитка «+».
 */
function LecturesPage() {
  const navigate = useNavigate();
  const { courseSlug: courseSlugParam } = useParams();

  const { current, semesters } = useSemester();

  // Data layer (resolves the course by slug, then its lectures)
  const { course, lectures, loading, error, refetch, deleteLecture } =
    useLectures(courseSlugParam ?? "");

  // UI state for the "create lecture" flow
  const [editingPlusIndex, setEditingPlusIndex] = useState<number | null>(
    null
  );

  const confirm = useConfirmDialog();

  /**
   * Called when a lecture is saved (created or updated).
   * Closes the editor and refreshes the list.
   */
  const handleSaved = () => {
    setEditingPlusIndex(null);
    void refetch();
  };

  // If the course belongs to another semester, redirect there.
  useEffect(() => {
    if (!course || !current || !courseSlugParam) return;
    const semId = courseSemesterId(course);
    if (semId && semId !== current.id) {
      const target = semesters.find((s) => s.id === semId);
      if (target) {
        navigate(`/s/${semesterSlug(target)}/${courseSlug(course)}`, {
          replace: true,
        });
      }
    }
  }, [course, current, semesters, courseSlugParam, navigate]);

  const semSlug = current ? semesterSlug(current) : "";

  return (
    <SemesterGate>
      {editingPlusIndex !== null ? (
        !course ? (
          <LoadingState />
        ) : (
          <LectureEditor
            courseId={course.id}
            onSaved={handleSaved}
            onCancel={() => setEditingPlusIndex(null)}
          />
        )
      ) : loading ? (
        <LoadingState />
      ) : (
        <>
          <Header
            crumbs={[
              { label: "Рабочий стол", to: `/s/${semSlug}` },
              { label: course ? courseName(course) : "Курс" },
            ]}
          />
          <div className="page">
            <ErrorBanner message={error} />

            <h1 className="page-title">
              {course ? courseName(course) : "Курс"}
            </h1>
            <p className="page-subtitle">
              Отсортировано по дате — новые выше.
            </p>

            <div className="bento">
              {lectures.map((lec, i) => (
                <LectureTile
                  key={lec.id}
                  lecture={lec}
                  index={i}
                  onClick={() =>
                    navigate(
                      `/s/${semSlug}/${courseSlugParam}/${lectureSlug(lec)}`
                    )
                  }
                  onEdit={() =>
                    navigate(
                      `/s/${semSlug}/${courseSlugParam}/${lectureSlug(lec)}/edit`
                    )
                  }
                  onDelete={() => {
                    const t = lectureTitle(lec);
                    confirm.ask(
                      "Удалить запись?",
                      `Запись «${t}» будет удалена.`,
                      () => {
                        void deleteLecture(lec.id);
                      }
                    );
                  }}
                />
              ))}

              <AddTile
                label="+ Добавить лекцию"
                onClick={() => setEditingPlusIndex(lectures.length)}
              />
            </div>

            <ConfirmDialog
              open={confirm.open}
              title={confirm.title}
              message={confirm.message}
              onConfirm={confirm.confirm}
              onCancel={confirm.cancel}
            />
          </div>
        </>
      )}
    </SemesterGate>
  );
}

export default LecturesPage;