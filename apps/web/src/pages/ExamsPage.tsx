import { useSemester } from "../lib/semesterContext";
import { useCourses } from "../hooks/useCourses";
import { useExamsForSemester } from "../hooks/useExam";
import { examDaysLeft, courseName, semesterSlug } from "../lib/types";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";
import ExamCourseCard from "../components/ExamCourseCard";

/**
 * ExamsPage — «Все экзамены» (`/s/:semesterSlug/exams`), сводка уровня
 * семестра поверх модуля, где сам экзамен живёт в ветке курса.
 * Структурно калька `CoursesPage.tsx`.
 *
 * Показывает ВСЕ курсы семестра, не только те, где экзамен уже заведён:
 * курс без экзамена получает карточку-приглашение (см. `ExamCourseCard`) —
 * экран отвечает на «где я ещё не начал», а не только «что уже начато».
 *
 * Сортировка: срочное → начатое без даты → не начатое. Не по проценту
 * готовности — иначе экран поощрял бы «сначала закрыть лёгкое» вместо
 * того, чтобы показывать реальные дедлайны.
 */
function ExamsPage() {
  const { current } = useSemester();
  const semesterId = current?.id ?? "";
  const semSlug = current ? semesterSlug(current) : "";

  const { courses, loading: coursesLoading, error } = useCourses(semesterId);
  const courseIds = courses.map((c) => c.id);
  const { byCourseId, loading: examsLoading } = useExamsForSemester(courseIds);

  const loading = coursesLoading && courses.length === 0;

  const sorted = [...courses].sort((a, b) => {
    const sa = byCourseId[a.id];
    const sb = byCourseId[b.id];
    const da = sa ? examDaysLeft(sa.exam) : null;
    const db = sb ? examDaysLeft(sb.exam) : null;

    // Срочное — по возрастанию дней (ближайший первым).
    if (da !== null && db !== null) return da - db;
    if (da !== null) return -1;
    if (db !== null) return 1;

    // Начатое без даты — перед не начатым.
    if (sa && !sb) return -1;
    if (!sa && sb) return 1;

    return courseName(a).localeCompare(courseName(b), "ru");
  });

  return (
    <SemesterGate>
      {loading ? (
        <LoadingState />
      ) : (
        <>
          <Header
            crumbs={[
              { label: "Рабочий стол", to: `/s/${semSlug}` },
              { label: "Экзамены" },
            ]}
          />
          <div className="page">
            <div className="content-canvas">
              <ErrorBanner message={error} />

              <h1 className="page-title">Экзамены</h1>
              <p className="page-subtitle">
                Семестр {semSlug} — подготовка по всем курсам.
              </p>

              {courses.length === 0 ? (
                <div className="empty">
                  Пока нет курсов в этом семестре — сначала добавьте курс.
                </div>
              ) : (
                <div className="bento">
                  {sorted.map((course, i) => (
                    <ExamCourseCard
                      key={course.id}
                      course={course}
                      index={i}
                      summary={byCourseId[course.id]}
                      semesterSlug={semSlug}
                    />
                  ))}
                </div>
              )}
              {examsLoading && courses.length > 0 && (
                <p className="page-subtitle">Загрузка прогресса…</p>
              )}
            </div>
          </div>
        </>
      )}
    </SemesterGate>
  );
}

export default ExamsPage;
