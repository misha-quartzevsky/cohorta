/**
 * ============================================
 *  SubjectLecturesPage.tsx — страница предмета, вкладка «Лекции» (B2)
 * ============================================
 *
 * Макеты: Screen-subject-lectures (десктоп), Screen-m-subject-lectures
 * (телефон). Маршрут `/s/:semesterSlug/:courseSlug`. Вкладки «Пары» и
 * «Экзамен» ведут на уже готовые экраны (`/pairs`, `/exam`).
 * Список — тот же, что на «Все лекции», но только лекции предмета и без
 * названия предмета в подписи.
 *
 * За флагом VITE_NEW_UI (App.tsx).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCourseBySlug } from "../hooks/useCourseBySlug";
import { useLecturesOverview } from "../hooks/useLecturesOverview";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useSchedule } from "../hooks/useSchedule";
import { useUiShell } from "../lib/uiShellContext";
import { useSemester } from "../lib/semesterContext";
import {
  courseName,
  courseSemesterId,
  lectureCourseId,
  type Course,
  lectureSlug,
  lectureTitle,
  semesterLabel,
  semesterSlug,
} from "../lib/types";
import { pickActiveSemester } from "../lib/activeSemester";
import { pluralRu } from "../lib/format";
import { todayStr } from "../lib/localDate";
import { createLectureInSubject } from "../services/scheduleService";
import { Button, EmptyState, Icon, Pills } from "../ui";
import type { LectureListStatusKey } from "../lib/computeLectureReadiness";
import LectureGroupList from "../components/lectures/LectureGroupList";
import LoadingState from "../components/LoadingState";
import ErrorBanner from "../components/ErrorBanner";
import NotFoundPage from "./NotFoundPage";

type StatusFilter = "all" | LectureListStatusKey;
type SubjectTab = "lectures" | "pairs" | "exam";

const STATUS_LABELS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "review", label: "Повторить" },
  { key: "weak", label: "Слабо" },
  { key: "not_started", label: "Не начато" },
];

/** «Черновики»: предмет по умолчанию для лекций без предмета (не запись в базе). */
export const DRAFTS_SLUG = "drafts";
const DRAFTS_COURSE = { id: "", name: "Черновики" } as Course;

export default function SubjectLecturesPage() {
  const navigate = useNavigate();
  const phone = useMediaQuery("(max-width: 1023px)");
  const { courseSlug: courseSlugParam = "" } = useParams();
  const isDrafts = courseSlugParam === DRAFTS_SLUG;
  const { course: fetchedCourse, loading: fetchedLoading, error: courseError } = useCourseBySlug(
    isDrafts ? "" : courseSlugParam
  );
  const course = isDrafts ? DRAFTS_COURSE : fetchedCourse;
  const courseLoading = isDrafts ? false : fetchedLoading;
  const { semesters, current } = useSemester();
  const activeSemester = current ?? pickActiveSemester(semesters);
  const semSlug = activeSemester ? semesterSlug(activeSemester) : "";
  const { rows, loading, error } = useLecturesOverview();
  const { openSearch } = useUiShell();
  const courseSemester = semesters.find((s) => s.id === (course ? courseSemesterId(course) : ""));
  const { slots } = useSchedule(courseSemester?.id);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Предмет из другого периода — переходим на адрес с его периодом.
  useEffect(() => {
    if (!course || !courseSemester) return;
    const slug = semesterSlug(courseSemester);
    if (semSlug && slug !== semSlug) navigate(`/s/${slug}/${courseSlugParam}`, { replace: true });
  }, [course, courseSemester, semSlug, courseSlugParam, navigate]);

  const courseRows = useMemo(
    () =>
      course
        ? rows.filter((r) => (isDrafts ? !lectureCourseId(r.lecture) : lectureCourseId(r.lecture) === course.id))
        : [],
    [rows, course, isDrafts]
  );

  const filtered = useMemo(() => {
    const q = phone ? "" : query.trim().toLowerCase();
    return courseRows.filter((row) => {
      if (statusFilter !== "all" && row.status.key !== statusFilter) return false;
      if (q && !lectureTitle(row.lecture).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [courseRows, statusFilter, query, phone]);

  if (courseLoading) return <LoadingState />;
  if (!course) {
    return courseError ? <ErrorBanner message={courseError} /> : <NotFoundPage />;
  }

  const base = `/s/${semSlug}/${courseSlugParam}`;
  const pairsCount = slots.filter((s) => s.subject === course.id).length;
  const periodText = courseSemester ? semesterLabel(courseSemester).toLowerCase() : "";
  const subtitle = `${courseRows.length} ${pluralRu(courseRows.length, ["лекция", "лекции", "лекций"])}${periodText ? ` · ${periodText}` : ""}`;

  async function newLecture() {
    if (!course || creating) return;
    if (isDrafts) {
      navigate("/note/new");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const created = await createLectureInSubject(
        course.id,
        courseRows.map((r) => r.lecture),
        todayStr()
      );
      navigate(`${base}/${lectureSlug(created)}/edit`);
    } catch {
      setCreateError("Не удалось создать лекцию. Попробуй ещё раз.");
      setCreating(false);
    }
  }

  const list =
    !loading && courseRows.length === 0 ? (
      <EmptyState
        icon="doc"
        title="В этом предмете пока нет лекций"
        description="Создай первую или добавь пары, тогда лекция появится на нужной дате."
        action={
          <Button variant="primary" onClick={() => void newLecture()}>
            Новая лекция
          </Button>
        }
      />
    ) : !loading && filtered.length === 0 ? (
      <EmptyState
        icon="search"
        title="Ничего не нашлось"
        description="Проверь написание или поищи по другому слову."
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
            }}
          >
            Очистить поиск
          </Button>
        }
      />
    ) : (
      <LectureGroupList rows={filtered} semSlug={semSlug} showSubject={false} />
    );

  const message = error || createError;

  /* ---------- Телефон ---------- */
  if (phone) {
    return (
      <div className="c-lec c-lec-m">
        <header className="c-lec-m-head">
          <button type="button" className="c-lec-m-back" onClick={() => navigate(`/s/${semSlug}/lectures`)}>
            <Icon name="chev" size={18} style={{ transform: "rotate(180deg)" }} />
            Лекции
          </button>
          <div className="c-lec-m-head-row">
            <h1>{courseName(course)}</h1>
            <span className="c-lec-m-head-actions">
              <button type="button" className="c-lec-m-icon" aria-label="Поиск" onClick={openSearch}>
                <Icon name="search" size={20} />
              </button>
              <button
                type="button"
                className="c-lec-m-icon"
                aria-label="Новая лекция"
                disabled={creating}
                onClick={() => void newLecture()}
              >
                <Icon name="plus" size={20} />
              </button>
            </span>
          </div>
          <span className="c-lec-m-count">{subtitle}</span>
        </header>

        {message && <p className="c-lec-error">{message}</p>}
        <div className="c-lec-m-body">{list}</div>

        <div className="c-lec-m-bar">
          {!isDrafts && (
          <div className="c-seg c-lec-m-tabs" role="tablist" aria-label="Раздел предмета">
            <span role="tab" aria-selected className="on" tabIndex={0}>
              Лекции
            </span>
            <span
              role="tab"
              aria-selected={false}
              tabIndex={0}
              onClick={() => navigate(`${base}/pairs`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(`${base}/pairs`);
              }}
            >
              Пары и экзамен
            </span>
          </div>
          )}
          <div className="c-lec-m-filters">
            {periodText && <span className="c-lec-period static">{semesterLabel(courseSemester!)}</span>}
            <div className="c-lec-m-pills" role="tablist" aria-label="Статус">
              {STATUS_LABELS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === s.key}
                  className={statusFilter === s.key ? "on" : ""}
                  onClick={() => setStatusFilter(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Компьютер ---------- */
  const tabs = [
    { value: "lectures" as SubjectTab, label: "Лекции", count: courseRows.length },
    { value: "pairs" as SubjectTab, label: "Пары", count: pairsCount },
    { value: "exam" as SubjectTab, label: "Экзамен" },
  ];
  return (
    <div className="c-lec">
      <div className="c-lec-head">
        <div className="c-lec-head-tx">
          <div className="c-lec-crumbs">
            <span>Предметы</span>
            <Icon name="chev" size={14} />
            <span className="cur">{courseName(course)}</span>
          </div>
          <h1>{courseName(course)}</h1>
          <span>{subtitle}</span>
        </div>
        <Button variant="secondary" disabled={creating} onClick={() => void newLecture()}>
          <Icon name="plus" size={18} />
          Новая лекция
        </Button>
      </div>

      <div className="c-lec-filters">
        {isDrafts ? (
          <span />
        ) : (
          <Pills<SubjectTab>
            aria-label="Раздел предмета"
            options={tabs}
            value="lectures"
            onChange={(v) => {
              if (v === "pairs") navigate(`${base}/pairs`);
              else if (v === "exam") navigate(`${base}/exam`);
            }}
          />
        )}
        <div className="c-lec-filters-end">
          {courseSemester && <span className="c-lec-period static">{semesterLabel(courseSemester)}</span>}
          <div className="c-lec-search c-lec-search-narrow">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Искать по названию"
              aria-label="Искать по названию"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {message && <p className="c-lec-error">{message}</p>}
      {list}
    </div>
  );
}
