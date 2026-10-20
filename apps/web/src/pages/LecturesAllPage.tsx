/**
 * ============================================
 *  LecturesAllPage.tsx — «Все лекции» (B2, перенос по макетам 19.10)
 * ============================================
 *
 * Десктоп (Screen-lectures): заголовок со счётчиком, «Новая лекция», пилюли по
 * статусу со счётчиками, поиск по названию, список с группами «Эта неделя» /
 * «Ранее».
 * Телефон (Screen-m-lectures-all / -subjects / -period): заголовок с иконками
 * поиска и «+», список сверху, внизу над панелью — переключатель «Все лекции /
 * Предметы», период и пилюли статуса. Старого Screen-m-lectures больше нет.
 *
 * За флагом VITE_NEW_UI (App.tsx).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSemester } from "../lib/semesterContext";
import { useUiShell } from "../lib/uiShellContext";
import { pickActiveSemester } from "../lib/activeSemester";
import { fetchCourses } from "../services/courseService";
import { useLecturesOverview } from "../hooks/useLecturesOverview";
import { useLecturePeriod } from "../hooks/useLecturePeriod";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { fetchExamsForCourses } from "../services/examService";
import { fetchSlots } from "../services/scheduleService";
import {
  courseName,
  courseSlug,
  examDate,
  lectureCourseId,
  semesterSlug,
  type Course,
  type Exam,
} from "../lib/types";
import { pluralRu } from "../lib/format";
import { Button, Icon, EmptyState, List, ListRow, Pills, Segmented, SubjectCover } from "../ui";
import type { LectureListStatusKey } from "../lib/computeLectureReadiness";
import LectureGroupList from "../components/lectures/LectureGroupList";
import PeriodSelect from "../components/lectures/PeriodSelect";
import DraftCover from "../components/lectures/DraftCover";

type StatusFilter = "all" | LectureListStatusKey;
type Tab = "all" | "subjects";

const STATUS_LABELS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "review", label: "Повторить" },
  { key: "weak", label: "Слабо" },
  { key: "not_started", label: "Не начато" },
];

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "all", label: "Все лекции" },
  { value: "subjects", label: "Предметы" },
];

function examDateLabel(exam?: Exam): string {
  const raw = exam ? examDate(exam) : "";
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return `Экзамен ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}

export default function LecturesAllPage() {
  const navigate = useNavigate();
  const phone = useMediaQuery("(max-width: 1023px)");
  const { current, semesters } = useSemester();
  const activeSemester = current ?? pickActiveSemester(semesters);
  const semSlug = activeSemester ? semesterSlug(activeSemester) : "";
  const { rows, loading, error } = useLecturesOverview();
  const { openSearch } = useUiShell();
  // И на компьютере (Screen-lectures-period), и на телефоне по умолчанию текущий период.
  const period = useLecturePeriod(false);
  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => {
    void fetchCourses()
      .then(setCourses)
      .catch(() => {});
  }, []);

  const [tab, setTab] = useState<Tab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const periodRows = useMemo(() => rows.filter((r) => period.includes(r.lecture)), [rows, period]);

  const countByStatus = useMemo(() => {
    const m: Record<LectureListStatusKey, number> = { not_started: 0, weak: 0, review: 0, learned: 0 };
    for (const row of periodRows) m[row.status.key] += 1;
    return m;
  }, [periodRows]);

  const filtered = useMemo(() => {
    return periodRows.filter((row) => {
      if (statusFilter !== "all" && row.status.key !== statusFilter) return false;
      return true;
    });
  }, [periodRows, statusFilter]);

  const subjectCount = useMemo(
    () => new Set(periodRows.map((r) => lectureCourseId(r.lecture)).filter(Boolean)).size,
    [periodRows]
  );

  const newLecture = () => navigate("/note/new");

  const statusPills = STATUS_LABELS.map((s) => ({
    value: s.key,
    label: s.label,
    count: s.key === "all" ? periodRows.length : countByStatus[s.key],
  }));

  const list =
    !loading && periodRows.length === 0 ? (
      <EmptyState
        icon="doc"
        title="Лекций пока нет"
        description="Создай первую или добавь пары, тогда лекция появится на нужной дате."
        action={
          <Button variant="primary" onClick={newLecture}>
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
              setStatusFilter("all");
            }}
          >
            Очистить поиск
          </Button>
        }
      />
    ) : (
      <LectureGroupList rows={filtered} semSlug={semSlug} showSubject />
    );

  /* ---------- Телефон ---------- */
  if (phone) {
    const lecturesWord = pluralRu(periodRows.length, ["лекция", "лекции", "лекций"]);
    const periodCourses = courses.filter(
      (c) => period.value === "all" || String(c.semesters ?? "") === period.value
    );
    return (
      <div className="c-lec c-lec-m">
        <header className="c-lec-m-head">
          <div className="c-lec-m-head-row">
            <h1>Лекции</h1>
            <span className="c-lec-m-head-actions">
              <button type="button" className="c-lec-m-icon" aria-label="Поиск" onClick={openSearch}>
                <Icon name="search" size={20} />
              </button>
              <button type="button" className="c-lec-m-icon" aria-label="Новая лекция" onClick={newLecture}>
                <Icon name="plus" size={20} />
              </button>
            </span>
          </div>
          <span className="c-lec-m-count">
            {tab === "all"
              ? `${periodRows.length} ${lecturesWord}`
              : `${periodCourses.length} ${pluralRu(periodCourses.length, ["предмет", "предмета", "предметов"])} · ${period.caption}`}
          </span>
        </header>

        {error && <p className="c-lec-error">{error}</p>}

        {tab === "all" ? (
          <div className="c-lec-m-body">{list}</div>
        ) : (
          <SubjectsTab
            courses={periodCourses}
            semSlug={semSlug}
            semesterId={period.value === "all" ? "" : period.value}
            rows={rows}
          />
        )}

        <div className="c-lec-m-bar">
          <Segmented
            className="c-lec-m-tabs"
            aria-label="Раздел"
            options={TAB_OPTIONS}
            value={tab}
            onChange={setTab}
          />
          <div className="c-lec-m-filters">
            <PeriodSelect options={period.options} value={period.value} onChange={period.setValue} />
            {tab === "all" && (
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
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Компьютер ---------- */
  return (
    <div className="c-lec">
      <div className="c-lec-head">
        <div className="c-lec-head-tx">
          <h1>Все лекции</h1>
          <span>
            {periodRows.length} {pluralRu(periodRows.length, ["лекция", "лекции", "лекций"])} в {subjectCount}{" "}
            {pluralRu(subjectCount, ["предмете", "предметах", "предметах"])}
          </span>
        </div>
        <Button variant="secondary" onClick={newLecture}>
          <Icon name="plus" size={18} />
          Новая лекция
        </Button>
      </div>

      <div className="c-lec-filters">
        <Pills<StatusFilter>
          aria-label="Статус"
          options={statusPills}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <div className="c-lec-filters-end">
          <PeriodSelect popover options={period.options} value={period.value} onChange={period.setValue} />
        </div>
      </div>

      {error && <p className="c-lec-error">{error}</p>}
      {list}
    </div>
  );
}

/** Вкладка «Предметы» на телефоне (Screen-m-lectures-subjects). */
function SubjectsTab({
  courses,
  semSlug,
  semesterId,
  rows,
}: {
  courses: Course[];
  semSlug: string;
  semesterId: string;
  rows: ReturnType<typeof useLecturesOverview>["rows"];
}) {
  const navigate = useNavigate();
  const [pairs, setPairs] = useState<Record<string, number>>({});
  const [exams, setExams] = useState<Record<string, Exam>>({});

  useEffect(() => {
    let cancelled = false;
    void fetchSlots(semesterId || undefined)
      .then((slots) => {
        if (cancelled) return;
        const m: Record<string, number> = {};
        for (const s of slots) m[s.subject] = (m[s.subject] ?? 0) + 1;
        setPairs(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [semesterId]);

  useEffect(() => {
    if (courses.length === 0) return;
    let cancelled = false;
    void fetchExamsForCourses(courses.map((c) => c.id))
      .then((list) => {
        if (cancelled) return;
        const m: Record<string, Exam> = {};
        for (const e of list) if (e.course) m[e.course] = e;
        setExams(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [courses]);

  const draftsCount = rows.filter((r) => !lectureCourseId(r.lecture)).length;
  const lectureCount = (courseId: string) =>
    rows.filter((r) => lectureCourseId(r.lecture) === courseId).length;

  return (
    <div className="c-lec-m-body">
      <List className="c-lec-list c-lec-subjects">
        {draftsCount > 0 && (
          <ListRow
            onClick={() => navigate(`/s/${semSlug}/drafts`)}
            cover={<DraftCover size={40} />}
            title="Черновики"
            meta="Лекции без предмета"
            right={
              <>
                <span className="c-lec-subject-count">{draftsCount}</span>
                <Icon name="chev" size={18} className="c-lec-chev" />
              </>
            }
          />
        )}
        {courses.map((c) => {
          const n = pairs[c.id] ?? 0;
          const sub = [
            n > 0 ? `${n} ${pluralRu(n, ["пара", "пары", "пар"])}` : "",
            examDateLabel(exams[c.id]),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <ListRow
              key={c.id}
              onClick={() => navigate(`/s/${semSlug}/${courseSlug(c)}`)}
              cover={<SubjectCover seed={c.cover_seed} size={40} />}
              title={courseName(c)}
              meta={sub || undefined}
              right={
                <>
                  <span className="c-lec-subject-count">{lectureCount(c.id)}</span>
                  <Icon name="chev" size={18} className="c-lec-chev" />
                </>
              }
            />
          );
        })}
        <button type="button" className="c-lec-add-subject" onClick={() => navigate(`/s/${semSlug}/courses`)}>
          <Icon name="plus" size={18} />
          Новый предмет
        </button>
      </List>
    </div>
  );
}
