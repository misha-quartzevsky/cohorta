/**
 * ============================================
 *  DraftsPage.tsx — «Черновики» (B2, Screen-drafts / Screen-m-drafts / -assign)
 * ============================================
 *
 * Предмет по умолчанию для лекций без предмета: приватный, виден только
 * владельцу, в сайдбаре появляется, пока в нём есть лекции. Назначение предмета
 * («Назначить предмет» на компьютере, «Предмет» и шторка на телефоне) переносит
 * лекцию навсегда — строка сразу пропадает, тост «Перенесено в «…»» с «Отменить».
 * Маршрут `/s/:semesterSlug/drafts`.
 */

import { useForms } from "../lib/formsContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useLecturesOverview } from "../hooks/useLecturesOverview";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useSemester } from "../lib/semesterContext";
import { pickActiveSemester } from "../lib/activeSemester";
import { fetchCourses } from "../services/courseService";
import { wordCount } from "../services/lectureActions";
import { courseName, courseSemesterId, lectureHref, lectureTitle, semesterSlug, type Course, type Lecture } from "../lib/types";
import { pluralRu } from "../lib/format";
import { Icon, Menu, Modal, SubjectCover } from "../ui";
import DraftCover from "../components/lectures/DraftCover";
import { useLectureActions } from "../components/lectures/useLectureActions";
import LoadingState from "../components/LoadingState";

function formatDate(dateStr: string | undefined, month: "long" | "short"): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month }).replace(".", "");
}

export default function DraftsPage() {
  const navigate = useNavigate();
  const forms = useForms();
  const phone = useMediaQuery("(max-width: 1023px)");
  const { semesters, current } = useSemester();
  const active = current ?? pickActiveSemester(semesters);
  const semSlug = active ? semesterSlug(active) : "";
  const { rows, loading } = useLecturesOverview();
  const actions = useLectureActions();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sheetFor, setSheetFor] = useState<Lecture | null>(null);

  useEffect(() => {
    void fetchCourses()
      .then(setCourses)
      .catch(() => {});
  }, []);

  const drafts = rows.map((r) => r.lecture).filter((l) => !l.field && !actions.isHidden(l));
  const subjects = courses.filter((c) => !active || courseSemesterId(c) === active.id);

  // Когда черновиков не осталось, предмет «Черновики» пропадает из сайдбара — уходим на «Все лекции».
  useEffect(() => {
    if (!loading && drafts.length === 0) navigate(`/s/${semSlug}/lectures`, { replace: true });
  }, [loading, drafts.length, semSlug, navigate]);

  if (loading && rows.length === 0) return <LoadingState />;

  const assign = (lecture: Lecture, course: Course) => {
    setSheetFor(null);
    void actions.move(lecture, course);
  };

  const subjectItems = (lecture: Lecture) => [
    ...subjects.map((c) => ({
      label: courseName(c),
      icon: <SubjectCover seed={c.cover_seed} size={22} />,
      onClick: () => assign(lecture, c),
    })),
    {
      label: "Новый предмет",
      icon: <Icon name="plus" size={18} />,
      separatorBefore: true,
      onClick: () => (forms ? forms.openSubjectForm() : navigate(`/s/${semSlug}/courses`)),
    },
  ];

  const open = (lecture: Lecture) => navigate(lectureHref(lecture, semSlug));
  const countText = `${drafts.length} ${pluralRu(drafts.length, ["лекция", "лекции", "лекций"])}`;

  const list = (
    <div className="c-list c-lec-list c-drafts-list">
      {drafts.map((lecture) => {
        const date = lecture.lecture_date || lecture.created;
        const words = wordCount(lecture.content);
        const wordsText = `${words} ${pluralRu(words, ["слово", "слова", "слов"])}`;
        const renaming = actions.renamingId === lecture.id;
        return (
          <div
            key={lecture.id}
            className={`c-row c-lec-row${renaming ? "" : " link"}`}
            role={renaming ? undefined : "link"}
            tabIndex={renaming ? undefined : 0}
            onClick={renaming ? undefined : (e) => e.currentTarget.contains(e.target as Node) && open(lecture)}
            onKeyDown={(e) => {
              if (!renaming && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                open(lecture);
              }
            }}
          >
            <span className="cv">
              <DraftCover size={40} />
            </span>
            <span className="tx">
              {renaming ? (
                <input
                  className="c-lec-rename-input"
                  autoFocus
                  defaultValue={lectureTitle(lecture)}
                  aria-label="Название лекции"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void actions.commitRename(lecture, e.currentTarget.value);
                    if (e.key === "Escape") actions.cancelRename();
                  }}
                  onBlur={(e) => void actions.commitRename(lecture, e.currentTarget.value)}
                />
              ) : (
                <>
                  <span className="t">{lectureTitle(lecture)}</span>
                  <span className="m">
                    {phone
                      ? `${formatDate(date, "short")} · ${wordsText}`
                      : `Создана ${formatDate(date, "long")} · ${wordsText}`}
                  </span>
                </>
              )}
            </span>
            {phone ? (
              <button
                type="button"
                className="c-btn secondary sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetFor(lecture);
                }}
              >
                Предмет
              </button>
            ) : (
              <>
                <Menu
                  width={280}
                  aria-label="Назначить предмет"
                  items={subjectItems(lecture)}
                  trigger={(p) => (
                    <button
                      type="button"
                      className="c-btn secondary sm"
                      ref={p.ref}
                      aria-expanded={p["aria-expanded"]}
                      aria-haspopup={p["aria-haspopup"]}
                      onClick={(e) => {
                        e.stopPropagation();
                        p.onClick();
                      }}
                    >
                      Назначить предмет
                      <Icon name="chevd" size={16} />
                    </button>
                  )}
                />
                {actions.menu(lecture)}
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={`c-lec${phone ? " c-lec-m" : ""}`}>
      {phone ? (
        <header className="c-lec-m-head">
          <button type="button" className="c-lec-m-back" onClick={() => navigate(`/s/${semSlug}/lectures`)}>
            <Icon name="chev" size={18} style={{ transform: "rotate(180deg)" }} />
            Лекции
          </button>
          <div className="c-lec-m-head-row">
            <h1>Черновики</h1>
          </div>
          <span className="c-lec-m-count">{countText} · видишь только ты</span>
        </header>
      ) : (
        <div className="c-lec-head">
          <div className="c-lec-head-tx">
            <div className="c-lec-crumbs">
              <span>Предметы</span>
              <Icon name="chev" size={14} />
              <span className="cur">Черновики</span>
            </div>
            <h1>Черновики</h1>
            <span>Лекции без предмета. Их видишь только ты. Когда назначишь предмет, лекция уйдёт отсюда навсегда.</span>
          </div>
        </div>
      )}

      <div className={phone ? "c-lec-m-body" : undefined}>{list}</div>
      {phone && (
        <p className="c-lec-footnote">Нажми «Предмет», чтобы назначить. Лекция сразу уйдёт из черновиков.</p>
      )}

      <Modal open={!!sheetFor} onClose={() => setSheetFor(null)} title="Назначить предмет" className="c-sheet-dialog" bare>
        {sheetFor && (
          <>
            <h2 className="c-pick-title">Назначить предмет</h2>
            <p className="c-pick-sub">{lectureTitle(sheetFor)}</p>
            <div className="c-pick-list c-pick-subjects" role="listbox" aria-label="Предмет">
              {subjects.map((c) => (
                <button key={c.id} type="button" role="option" aria-selected={false} onClick={() => assign(sheetFor, c)}>
                  <SubjectCover seed={c.cover_seed} size={28} />
                  <span>{courseName(c)}</span>
                </button>
              ))}
              <button
                type="button"
                className="new"
                onClick={() => {
                  setSheetFor(null);
                  if (forms) forms.openSubjectForm();
                  else navigate(`/s/${semSlug}/courses`);
                }}
              >
                <Icon name="plus" size={18} />
                <span>Новый предмет</span>
              </button>
            </div>
          </>
        )}
      </Modal>
      {actions.dialogs}
    </div>
  );
}
