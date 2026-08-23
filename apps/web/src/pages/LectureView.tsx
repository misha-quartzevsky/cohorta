import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";

import {
  courseName,
  lectureBody,
  lectureCourseId,
  lectureExcerpt,
  lectureSlug,
  lectureTitle,
} from "../lib/types";
import { formatDate } from "../lib/format";
import { writeLastVisited } from "../lib/lastVisited";
import { deleteLecture, resolveFileTokens } from "../services/lectureService";
import { useLectureBySlug } from "../hooks/useLectureBySlug";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useLectureFrame } from "../lib/lectureFrame";

import ErrorBanner from "../components/ErrorBanner";
import ConfirmDialog from "../components/ConfirmDialog";
import CardSkeleton from "../components/CardSkeleton";
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

  // `ready` needed by effects below — compute it here (not only near the JSX).
  const ready = !!lecture && !loading;

  const confirm = useConfirmDialog();
  const frame = useLectureFrame();
  const { setTitle, tocContainerRef } = frame;

  // Assign contentRef to the shared TOC container in the layout context.
  // Depends on `ready`: the container div only mounts after the lecture loads,
  // so re-assign the ref when it appears (was once-only → sidebar TOC saw null).
  useLayoutEffect(() => {
    tocContainerRef.current = contentRef.current;
  }, [tocContainerRef, ready]);

  // Токены `[[file:…]]` → абсолютные URL файлов PB перед отрисовкой.
  useLayoutEffect(() => {
    if (!lecture) return;
    setContent(resolveFileTokens(lectureBody(lecture), lecture) || "");
  }, [lecture]);

    // Отрисовываем формулы MathLive после вставки HTML (данные — в атрибуте).
  // useLayoutEffect срабатывает после commit-фазы, когда dangerouslySetInnerHTML
  // уже применил HTML к DOM. Зависимость от id лекции: при SPA-переходе на
  // лекцию с идентичным `content` эффект перезапускается.
  //
  // Рендер формулы вынесен в «самовосстанавливающийся» слой: помимо синхронного
  // вызова — retry-таймеры и MutationObserver на контейнере. Это защищает от
  // гонки, при которой React re-render (или wipe dangerouslySetInnerHTML после
  // очередного апдейта `content`) стирает только-что вставленный <math-div>,
  // а зависимые useLayoutEffect deps `[content]` могут не измениться.
  useLayoutEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const renderBlocks = () => {
      root
        .querySelectorAll<HTMLElement>("[data-type='math-block']")
        .forEach((block) => {
          void renderLatexInto(block, block.dataset.latex || "");
        });
    };

    // Синхронный рендер сразу после коммита (HTML уже в DOM).
    renderBlocks();

    // «Повторные выстрелы» — на случай missed первого рендера.
    const t1 = window.setTimeout(renderBlocks, 120);
    const t2 = window.setTimeout(renderBlocks, 600);
    const t3 = window.setTimeout(renderBlocks, 1500);

    // Самовосстановление: пере-рендерим формулы каждый раз, когда React или
    // dangerouslySetInnerHTML вставит/снимет math-block внутри контейнера.
    const observer = new MutationObserver(() => renderBlocks());
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      observer.disconnect();
    };
  }, [content, lecture?.id]);

  // Синхронизируем последнюю крошку шапки (живёт в LectureLayout).
  useLayoutEffect(() => {
    setTitle("");
  }, [lectureSlugParam, setTitle]);
  useLayoutEffect(() => {
    if (lecture) setTitle(lectureTitle(lecture));
  }, [lecture, setTitle]);

  // «Продолжить» (Dashboard): пишем последнюю посещённую лекцию в localStorage.
  useEffect(() => {
    if (!lecture) return;
    const course = lecture.expand?.field;
    const target =
      isCourseContext && courseSlug
        ? `/s/${semesterSlug}/${courseSlug}/${lectureSlug(lecture)}`
        : `/note/${lectureSlug(lecture)}`;
    writeLastVisited({
      to: target,
      title: lectureTitle(lecture),
      courseName: course ? courseName(course) : undefined,
      excerpt: lectureExcerpt(lecture, 140),
      savedAt: lecture.updated,
    });
  }, [lecture, isCourseContext, semesterSlug, courseSlug]);

  const handleEdit = () => {
    if (isCourseContext) {
      navigate(`/s/${semesterSlug}/${courseSlug}/${lectureSlugParam}/edit`);
    } else {
      navigate(`/note/${lectureSlugParam}/edit`);
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
