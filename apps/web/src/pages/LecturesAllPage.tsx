/**
 * ============================================
 *  LecturesAllPage.tsx — «Все лекции» (B2, 2026-10-19)
 * ============================================
 *
 * Вёрстка 1:1 по docs/design/screens/Screen-lectures(-m).dc.html.
 * Список, не плитки. Фильтры-пилюли разные на десктопе и телефоне
 * (CSS-переключение, см. styles/components.css): десктоп — по статусу
 * готовности, телефон — по предмету (так в обоих макетах, не придумано).
 *
 * За флагом VITE_NEW_UI — подключена в App.tsx вместо алиаса на
 * CoursesPage только когда isNewUI() (см. там же).
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSemester } from "../lib/semesterContext";
import { useUiShell } from "../lib/uiShellContext";
import { pickActiveSemester } from "../lib/activeSemester";
import { useCourses } from "../hooks/useCourses";
import { useLecturesOverview, type LectureOverviewRow } from "../hooks/useLecturesOverview";
import {
  courseName,
  lectureCourseId,
  lectureHref,
  lectureTitle,
  semesterSlug,
} from "../lib/types";
import { pluralRu } from "../lib/format";
import { Button, Icon, StatusChip, EmptyState } from "../ui";
import { List, ListRow } from "../ui";
import { SubjectCover } from "../ui";
import type { LectureListStatusKey } from "../lib/computeLectureReadiness";

type StatusFilter = "all" | LectureListStatusKey;

const STATUS_PILLS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "review", label: "Повторить" },
  { key: "weak", label: "Слабо" },
  { key: "not_started", label: "Не начато" },
];

function formatLongRu(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function formatShortRu(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
}

export default function LecturesAllPage() {
  const navigate = useNavigate();
  const { current, semesters } = useSemester();
  const activeSemester = current ?? pickActiveSemester(semesters);
  const semSlug = activeSemester ? semesterSlug(activeSemester) : "";
  const { courses } = useCourses(activeSemester?.id ?? "");
  const { rows, loading, error } = useLecturesOverview();
  const { openSearch } = useUiShell();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const countByStatus = useMemo(() => {
    const m: Record<LectureListStatusKey, number> = {
      not_started: 0,
      weak: 0,
      review: 0,
      learned: 0,
    };
    for (const row of rows) m[row.status.key] += 1;
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status.key !== statusFilter) return false;
      if (subjectFilter !== "all" && lectureCourseId(row.lecture) !== subjectFilter) {
        return false;
      }
      if (q && !lectureTitle(row.lecture).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusFilter, subjectFilter, query]);

  const openLecture = (row: LectureOverviewRow) => {
    navigate(lectureHref(row.lecture, semSlug));
  };

  return (
    <div className="c-lectures">
      {/* Десктоп: заголовок + «Новая лекция». */}
      <div className="c-lectures-head">
        <div className="c-lectures-head-tx">
          <h1>Все лекции</h1>
          <span>
            {rows.length} {pluralRu(rows.length, ["лекция", "лекции", "лекций"])} в{" "}
            {courses.length} {pluralRu(courses.length, ["предмете", "предметах", "предметах"])}
          </span>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/s/${semSlug}/courses`)}>
          <Icon name="plus" size={18} />
          Новая лекция
        </Button>
      </div>

      {/* Телефон: заголовок + поиск/добавить иконками. */}
      <div className="c-lectures-m-head">
        <div className="c-lectures-m-head-row">
          <h1>Лекции</h1>
          <span className="c-lectures-m-head-actions">
            <button
              type="button"
              className="c-lectures-m-icon"
              aria-label="Поиск"
              onClick={openSearch}
            >
              <Icon name="search" size={20} />
            </button>
            <button
              type="button"
              className="c-lectures-m-icon"
              aria-label="Новая лекция"
              onClick={() => navigate(`/s/${semSlug}/courses`)}
            >
              <Icon name="plus" size={20} />
            </button>
          </span>
        </div>
        <span className="c-lectures-m-count">
          {rows.length} {pluralRu(rows.length, ["лекция", "лекции", "лекций"])}
        </span>
      </div>

      <div className="c-lectures-filters">
        {/* Десктоп: пилюли по статусу (Screen-lectures.dc.html). */}
        <div className="c-pills c-lectures-pills-status" role="tablist" aria-label="Статус">
          {STATUS_PILLS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={statusFilter === p.key}
              className={statusFilter === p.key ? "on" : ""}
              onClick={() => setStatusFilter(p.key)}
            >
              {p.label}
              {p.key !== "all" && ` ${countByStatus[p.key]}`}
              {p.key === "all" && ` ${rows.length}`}
            </button>
          ))}
        </div>

        {/* Телефон: пилюли по предмету (Screen-m-lectures.dc.html). */}
        <div
          className="c-pills c-lectures-pills-subject"
          role="tablist"
          aria-label="Предмет"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subjectFilter === "all"}
            className={subjectFilter === "all" ? "on" : ""}
            onClick={() => setSubjectFilter("all")}
          >
            Все
          </button>
          {courses.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={subjectFilter === c.id}
              className={subjectFilter === c.id ? "on" : ""}
              onClick={() => setSubjectFilter(c.id)}
            >
              {courseName(c)}
            </button>
          ))}
        </div>

        {/* Десктоп: локальный фильтр по названию. */}
        <div className="c-lectures-search">
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

      {error && <p className="c-lectures-error">{error}</p>}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon="doc"
          title="Лекций пока нет"
          description="Создай первую или добавь пары, тогда лекция появится на нужной дате."
          action={
            <Button variant="primary" onClick={() => navigate(`/s/${semSlug}/courses`)}>
              Новая лекция
            </Button>
          }
        />
      ) : !loading && filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="Ничего не нашлось"
          description="Проверь написание или поищи по другому слову. Тексты чужих лекций в поиске не участвуют."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
                setSubjectFilter("all");
              }}
            >
              Очистить поиск
            </Button>
          }
        />
      ) : (
        <List className="c-lectures-list">
          {filtered.map((row) => {
            const course = lectureCourseId(row.lecture)
              ? row.lecture.expand?.field
              : undefined;
            const number = row.lecture.number;
            return (
              <ListRow
                key={row.lecture.id}
                onClick={() => openLecture(row)}
                cover={<SubjectCover seed={course?.cover_seed} size={40} />}
                title={lectureTitle(row.lecture)}
                meta={
                  <>
                    <span className="c-lectures-meta-desktop">
                      {course ? courseName(course) : "Без предмета"}
                      {number ? ` · Лекция ${number}` : ""}
                      {row.lecture.lecture_date
                        ? ` · ${formatLongRu(row.lecture.lecture_date)}`
                        : ""}
                    </span>
                    <span className="c-lectures-meta-mobile">
                      {course ? courseName(course) : "Без предмета"}
                      {row.lecture.lecture_date
                        ? ` · ${formatShortRu(row.lecture.lecture_date)}`
                        : ""}
                    </span>
                  </>
                }
                right={
                  <>
                    <StatusChip tone={row.status.tone}>{row.status.label}</StatusChip>
                    <Icon name="chev" size={18} className="c-lectures-row-chev" />
                  </>
                }
              />
            );
          })}
        </List>
      )}
    </div>
  );
}
