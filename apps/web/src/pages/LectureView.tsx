import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Trash2 } from "lucide-react";

import {
  courseName,
  lectureBody,
  lectureCourseId,
  lectureExcerpt,
  lectureSlug,
  lectureTitle,
  stripHtml,
  tagLectureIds,
} from "../lib/types";
import { formatDate } from "../lib/format";
import { writeLastVisited } from "../lib/lastVisited";
import {
  deleteLecture,
  resolveFileTokens,
  tokenizePbFileUrls,
  updateLecture,
  uploadLectureImages,
} from "../services/lectureService";
import { fetchTags } from "../services/tagService";
import { useLectureBySlug } from "../hooks/useLectureBySlug";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useAutosave } from "../hooks/useAutosave";
import { useLectureFrame } from "../lib/lectureFrame";
import { useUndo } from "../lib/undoContext";

import ErrorBanner from "../components/ErrorBanner";
import ConfirmDialog from "../components/ConfirmDialog";
import CardSkeleton from "../components/CardSkeleton";
import Editor from "../components/Editor";
import SpeechToText from "../components/SpeechToText";
import TagEditor from "../components/TagEditor";
import SaveIndicator from "../components/SaveIndicator";
import { renderLatexInto } from "../components/math/renderLatex";

/**
 * LectureView — страница лекции / заметки с редактированием «на месте».
 *
 * Notion/Obsidian-стиль: отдельного режима правки нет. Тело записи сначала
 * показывается как статичный HTML (дёшево, MathLive-формулы гидрируются
 * императивно), а по первому клику в текст на его месте лениво монтируется
 * полноценный Tiptap-редактор с кареткой в точке клика. Заголовок и теги
 * редактируемы всегда. Всё пишется в PocketBase с debounce (~1.2 с).
 *
 * Рендерится внутри <LectureLayout/> (карточка в <Outlet/>); шапка и сайдбар
 * живут в лейауте и не перемонтируются при смене лекции.
 */
function LectureView() {
  const { semesterSlug, courseSlug, lectureSlug: lectureSlugParam } =
    useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { lecture, loading, error } = useLectureBySlug(lectureSlugParam ?? "");
  const isCourseContext = !!courseSlug;

  // `/…/edit` — рабочий алиас: та же страница, но сразу в режиме редактора.
  const startLive = location.pathname.endsWith("/edit");
  const startLiveRef = useRef(startLive);
  startLiveRef.current = startLive;

  const [mode, setMode] = useState<"static" | "live">(
    startLive ? "live" : "static"
  );
  const [clickCoords, setClickCoords] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const titleRef = useRef("");
  const contentRef = useRef("");
  const tagsRef = useRef<string[]>([]);

  // Стабильный контейнер для сканера оглавления (не перемонтируется при
  // static↔live свапе); staticBodyRef — внутренний div статичного HTML.
  const contentWrapRef = useRef<HTMLDivElement | null>(null);
  const staticBodyRef = useRef<HTMLDivElement | null>(null);

  const ready = !!lecture && loaded;

  const confirm = useConfirmDialog();
  const { scheduleDelete } = useUndo();
  const frame = useLectureFrame();
  const {
    setTitle: setCrumbTitle,
    registerFlush,
    tocContainerRef,
    bumpToc,
  } = frame;

  // При смене цели: сбрасываем «загружено», крошку и режим тела.
  useEffect(() => {
    setLoaded(false);
    setCrumbTitle("");
    setMode(startLiveRef.current ? "live" : "static");
    setClickCoords(null);
  }, [lectureSlugParam, setCrumbTitle]);

  // Инициализация полей + тегов, когда лекция резолвится.
  useEffect(() => {
    if (!lecture) return;
    let cancelled = false;
    const t = lectureTitle(lecture);
    // Токены `[[file:…]]` → абсолютные URL (чтобы картинки видел и TipTap).
    const c = resolveFileTokens(lectureBody(lecture), lecture);
    titleRef.current = t;
    contentRef.current = c;
    setTitle(t);
    setContent(c);
    // Пустую запись открываем сразу в редакторе — читать нечего.
    if (startLiveRef.current || !stripHtml(c).trim()) setMode("live");
    fetchTags()
      .then((all) => {
        if (cancelled) return;
        const ids = all
          .filter((tg) => tagLectureIds(tg).includes(lecture.id))
          .map((tg) => tg.id);
        tagsRef.current = ids;
        setTags(ids);
      })
      .catch((e) => {
        console.error("Ошибка загрузки тегов:", e);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lecture]);

  // Синхронизируем последнюю крошку шапки (живёт в LectureLayout).
  useLayoutEffect(() => {
    if (lecture) setCrumbTitle(lectureTitle(lecture));
  }, [lecture, setCrumbTitle]);

  // Контейнер оглавления — внешний wrapper, стабильный через static↔live.
  useLayoutEffect(() => {
    tocContainerRef.current = contentWrapRef.current;
  }, [tocContainerRef, ready, mode]);

  // Смена режима меняет DOM тела — просим сайдбар пере-сканировать заголовки.
  useEffect(() => {
    bumpToc();
  }, [mode, bumpToc]);

  // Отрисовываем формулы MathLive в статичном HTML (в live-режиме этим
  // занимается NodeView MathBlock). Логика «самовосстановления» — как раньше:
  // синхронный проход + retry-таймеры + MutationObserver на контейнере.
  useLayoutEffect(() => {
    if (mode !== "static") return;
    const root = staticBodyRef.current;
    if (!root) return;

    const renderBlocks = () => {
      root
        .querySelectorAll<HTMLElement>("[data-type='math-block']")
        .forEach((block) => {
          void renderLatexInto(block, block.dataset.latex || "");
        });
    };

    renderBlocks();
    const t1 = window.setTimeout(renderBlocks, 120);
    const t2 = window.setTimeout(renderBlocks, 600);
    const t3 = window.setTimeout(renderBlocks, 1500);

    const observer = new MutationObserver(() => renderBlocks());
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      observer.disconnect();
    };
    // `ready` is a dep: content is seeded one render before `loaded` flips, so
    // the static container (gated on `ready`) mounts without `content` changing
    // — without `ready` here the effect would never see the attached ref.
  }, [content, lecture?.id, mode, ready]);

  // «Продолжить» (Dashboard): пишем последнюю посещённую запись в localStorage.
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

  // ---- Автосохранение (title / content / tags) --------------------------
  const doSave = useCallback(async () => {
    if (!lecture) return;
    await updateLecture(
      lecture.id,
      titleRef.current.trim() || "Без названия",
      // Абсолютные URL картинок → портативные токены [[file:…]].
      tokenizePbFileUrls(contentRef.current, lecture),
      tagsRef.current
    );
  }, [lecture]);

  const { saveState, saveText, flush } = useAutosave({
    save: doSave,
    deps: [title, content, tags],
    enabled: ready,
  });

  // Навигация по сайдбару в лейауте сначала сбрасывает несохранённое.
  useEffect(() => {
    if (mode !== "live") {
      registerFlush(null);
      return;
    }
    registerFlush(async () => {
      await flush();
    });
    return () => registerFlush(null);
  }, [mode, flush, registerFlush]);

  const updateTitle = (v: string) => {
    titleRef.current = v;
    setTitle(v);
  };
  const updateContent = (v: string) => {
    contentRef.current = v;
    setContent(v);
  };
  const updateTags = (ids: string[]) => {
    tagsRef.current = ids;
    setTags(ids);
  };

  // Загрузка картинок в поле `file` лекции (для Editor'а и диктофона).
  const handleUploadImages = useCallback(
    async (files: File[]) => {
      if (!lecture) {
        throw new Error("Запись ещё не создана.");
      }
      return uploadLectureImages(lecture, files);
    },
    [lecture]
  );

  // Клик в статичное тело → монтируем редактор с кареткой в точке клика.
  const enterLiveAt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement;
    // Ссылки / чекбоксы задач работают нативно, не перехватываем.
    if (el.closest("a, input")) return;
    setClickCoords({ left: e.clientX, top: e.clientY });
    setMode("live");
  };

  const handleDelete = () => {
    if (!lecture) return;
    const id = lecture.id;
    const name = lectureTitle(lecture);
    confirm.ask("Удалить запись?", `Запись «${name}» будет удалена.`, () => {
      scheduleDelete(`lecture:${id}`, `Запись «${name}» удалена`, () =>
        deleteLecture(id)
      );
      navigate(
        isCourseContext
          ? `/s/${semesterSlug}/${courseSlug}`
          : `/s/${semesterSlug}`
      );
    });
  };

  const unassigned = lecture ? !lectureCourseId(lecture) : false;
  const isHtmlContent = !!(lecture && /<[a-z][\s\S]*>/i.test(content));

  return (
    <>
      <main className="workspace-main" key={lectureSlugParam || "view"}>
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
              <input
                className="lecture-title-input"
                value={title}
                placeholder="Название записи"
                onChange={(e) => updateTitle(e.target.value)}
              />
              <TagEditor selectedIds={tags} onChange={updateTags} />
              <div className="lecture-card-actions">
                <SaveIndicator state={saveState} text={saveText} />
                <button
                  className="icon-btn danger"
                  type="button"
                  onClick={handleDelete}
                  title="Удалить"
                  aria-label="Удалить"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </header>

            <div ref={contentWrapRef} className="lecture-card-body">
              {mode === "static" ? (
                <div
                  ref={staticBodyRef}
                  className={`lecture-view-content editable-surface ${
                    isHtmlContent ? "is-html" : "is-plain"
                  }`}
                  title="Нажмите, чтобы редактировать"
                  onPointerDown={enterLiveAt}
                  dangerouslySetInnerHTML={{ __html: content || "" }}
                />
              ) : (
                <>
                  <Editor
                    // key=id: между лекциями редактор пересоздаётся целиком
                    // (иначе при идентичном content застревает прошлый текст,
                    // а блоки формул не перемонтируются).
                    key={lecture.id}
                    value={content}
                    onUpdate={updateContent}
                    className="editor-inline"
                    onUploadImages={handleUploadImages}
                    selectionCoords={clickCoords}
                  />
                  {/* Речь + аудиозапись: регистрирует запись в SpeechProvider. */}
                  <SpeechToText lecture={lecture} onUpload={handleUploadImages} />
                </>
              )}
            </div>
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
