import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";

import {
  lectureBody,
  lectureCourseId,
  lectureTitle,
} from "../lib/types";
import { formatDate } from "../lib/format";
import { deleteLecture, resolveFileTokens } from "../services/lectureService";
import { useLectureBySlug } from "../hooks/useLectureBySlug";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useLectureFrame } from "../lib/lectureFrame";

import ErrorBanner from "../components/ErrorBanner";
import ConfirmDialog from "../components/ConfirmDialog";
import CardSkeleton from "../components/CardSkeleton";
import TableOfContents from "../components/TableOfContents";
import TagBadges from "../components/TagBadges";
import { renderLatexInto } from "../components/math/renderLatex";

/**
 * LectureView — страница лекции / заметки.
 * Рендерится внутри <LectureLayout/> (карточка + оглавление в <Outlet/>);
 * шапка и сайдбар живут в лейауте и не перемонтируются при смене лекции.
 */
function LectureView() {
  const { semesterSlug, courseSlug, lectureSlug: lectureSlugParam } =
    useParams();
  const navigate = useNavigate();

  const { lecture, loading, error } = useLectureBySlug(lectureSlugParam ?? "");
  const isCourseContext = !!courseSlug;

  const [content, setContent] = useState("");
  const contentRef = useRef<HTMLDivElement | null>(null);

  const confirm = useConfirmDialog();
  const { setTitle } = useLectureFrame();

  // Токены `[[file:…]]` → абсолютные URL файлов PB перед отрисовкой.
  useEffect(() => {
    if (!lecture) return;
    setContent(resolveFileTokens(lectureBody(lecture), lecture) || "");
  }, [lecture]);

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

  // Синхронизируем последнюю крошку шапки (живёт в LectureLayout).
  useEffect(() => {
    setTitle("");
  }, [lectureSlugParam, setTitle]);
  useEffect(() => {
    if (lecture) setTitle(lectureTitle(lecture));
  }, [lecture, setTitle]);

  const handleEdit = () => {
    if (isCourseContext) {
      navigate(`/s/${semesterSlug}/${courseSlug}/${lectureSlugParam}/edit`);
    } else {
      navigate(`/s/${semesterSlug}/note/${lectureSlugParam}/edit`);
    }
  };

  const title = lecture ? lectureTitle(lecture) : "";
  const unassigned = lecture ? !lectureCourseId(lecture) : false;

  const handleDelete = () => {
    if (!lecture) return;
    confirm.ask("Удалить запись?", `Запись «${title}» будет удалена.`, () => {
      void deleteLecture(lecture.id).then(() => {
        navigate(
          isCourseContext
            ? `/s/${semesterSlug}/${courseSlug}`
            : `/s/${semesterSlug}`
        );
      });
    });
  };

  const isHtmlContent = !!(lecture && /<[a-z][\s\S]*>/i.test(content));
  const ready = !!lecture && !loading;

  return (
    <>
      <main
        className="workspace-main"
        key={lectureSlugParam || "view"}
      >
        {error && !lecture && (
          <ErrorBanner message={error || "Запись не найдена."} />
        )}
        {!lecture && !loading && !error && (
          <div className="empty">Запись не найдена.</div>
        )}
        {!lecture && loading && <CardSkeleton />}

        {ready && (
          <article className="lecture-card">
            <header className="lecture-card-head">
              <p className="lecture-card-meta">
                {formatDate(lecture.created)}
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
                  onClick={handleDelete}
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
        )}
      </main>

      <aside className="workspace-toc">
        {ready ? (
          <TableOfContents containerRef={contentRef} version={content} />
        ) : (
          <div className="workspace-toc-spacer" />
        )}
      </aside>

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.confirm}
        onCancel={confirm.cancel}
      />
    </>
  );
}

export default LectureView;
