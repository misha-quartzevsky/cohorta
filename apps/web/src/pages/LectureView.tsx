/**
 * ============================================
 *  LectureView.tsx — Страница лекции / заметки
 * ============================================
 *
 * Три колонки: список лекций курса (glass), белая карточка
 * с контентом, живое оглавление справа.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";

import type { Lecture } from "../lib/types";
import {
  courseName,
  lectureBody,
  lectureCourseId,
  lectureTitle,
} from "../lib/types";
import {
  deleteLecture,
  fetchLectureBySlug,
  resolveFileTokens,
} from "../services/lectureService";
import { useLectures } from "../hooks/useLectures";

import Header, { type Crumb } from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import ConfirmDialog from "../components/ConfirmDialog";
import LectureSidebar from "../components/LectureSidebar";
import TableOfContents from "../components/TableOfContents";
import TagBadges from "../components/TagBadges";
import { renderLatexInto } from "../components/math/renderLatex";

function LectureView() {
  const {
    semesterSlug,
    courseSlug,
    lectureSlug: lectureSlugParam,
  } = useParams();
  const navigate = useNavigate();

  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [content, setContent] = useState("");
  const contentRef = useRef<HTMLDivElement | null>(null);

  const isCourseContext = !!courseSlug;
  const { course, lectures } = useLectures(courseSlug || "");

  useEffect(() => {
    if (!lectureSlugParam) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchLectureBySlug(lectureSlugParam)
      .then((rec) => {
        if (!cancelled) {
          setLecture(rec);
          // Токены `[[file:…]]` → абсолютные URL файлов PB перед отрисовкой.
          setContent(resolveFileTokens(lectureBody(rec), rec) || "");
        }
      })
      .catch((e) => {
        console.error("Ошибка загрузки записи:", e);
        if (!cancelled) {
          setError(
            "Не удалось загрузить запись: " +
              (e instanceof Error ? e.message : String(e))
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lectureSlugParam]);

  // Отрисовываем формулы MathLive после вставки HTML (данные — в атрибуте).
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const blocks = root.querySelectorAll<HTMLElement>(
      "[data-type='math-block']"
    );
    blocks.forEach((el) => {
      const latex = el.getAttribute("data-latex") ?? "";
      void renderLatexInto(el, latex);
    });
  }, [content]);

  if (loading) return <LoadingState />;

  if (!lecture) {
    return (
      <>
        <Header crumbs={[{ label: "Рабочий стол" }]} />
        <div className="page">
          <ErrorBanner message={error || "Запись не найдена."} />
        </div>
      </>
    );
  }

  const title = lectureTitle(lecture);
  const unassigned = !lectureCourseId(lecture);
  const isHtmlContent = /<[a-z][\s\S]*>/i.test(content);

  const crumbs: Crumb[] =
    isCourseContext && course
      ? [
          { label: "Рабочий стол", to: `/s/${semesterSlug}` },
          {
            label: courseName(course),
            to: `/s/${semesterSlug}/${courseSlug}`,
          },
          { label: title },
        ]
      : [
          { label: "Рабочий стол", to: `/s/${semesterSlug}` },
          { label: title },
        ];

  const goToCourse = () => navigate(`/s/${semesterSlug}/${courseSlug}`);

  const handleEdit = () => {
    if (isCourseContext) {
      navigate(`/s/${semesterSlug}/${courseSlug}/${lectureSlugParam}/edit`);
    } else {
      navigate(`/s/${semesterSlug}/note/${lectureSlugParam}/edit`);
    }
  };

  const handleDelete = async () => {
    await deleteLecture(lecture.id);
    setConfirmOpen(false);
    navigate(
      isCourseContext
        ? `/s/${semesterSlug}/${courseSlug}`
        : `/s/${semesterSlug}`
    );
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <div className="page">
        <ErrorBanner message={error} />

      <div className={`workspace${isCourseContext ? "" : " no-sidebar"}`}>
        {isCourseContext && (
          <LectureSidebar
            courseName={course ? courseName(course) : "Курс"}
            lectures={lectures}
            activeSlug={lectureSlugParam || ""}
            onSelect={(slug) =>
              navigate(`/s/${semesterSlug}/${courseSlug}/${slug}`)
            }
            onBack={goToCourse}
          />
        )}

        <main className="workspace-main">
          <article className="lecture-card">
            <header className="lecture-card-head">
              <p className="lecture-card-meta">
                {new Date(lecture.created).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {unassigned && " · Не привязана к курсу"}
              </p>
              <h1 className="lecture-card-title">{title}</h1>
              <TagBadges lectureId={lecture.id} />
              <div className="lecture-card-actions">
                <button
                  className="icon-btn"
                  type="button"
                  onClick={handleEdit}
                  title="Редактировать"
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-btn danger"
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  title="Удалить"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </header>
            <div
              ref={contentRef}
              className={`lecture-card-body lecture-view-content ${
                isHtmlContent ? "is-html" : "is-plain"
              }`}
              dangerouslySetInnerHTML={{ __html: content || "" }}
            />
          </article>
        </main>

        <aside className="workspace-toc">
          <TableOfContents containerRef={contentRef} version={content} />
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Удалить запись?"
        message={`Запись «${title}» будет удалена.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      </div>
    </>
  );
}

export default LectureView;
