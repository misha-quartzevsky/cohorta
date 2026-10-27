import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

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
import { writeLastVisited } from "../lib/lastVisited";
import {
  resolveFileTokens,
  tokenizePbFileUrls,
  updateLecture,
  uploadLectureImages,
} from "../services/lectureService";
import { fetchTags } from "../services/tagService";
import { createTaskFromLecture } from "../services/taskService";
import { Modal, StatusChip, useToast } from "../ui";
import { lectureListStatus } from "../lib/computeLectureReadiness";
import { lectureDateLabel, repeatedAgoLabel } from "../lib/lectureMeta";
import { parsePbDate } from "../lib/format";
import LinkedTicketsPlaque from "../components/LinkedTicketsPlaque";
import { useLectureReadiness } from "../hooks/useLectureReadiness";
import { fetchTicketsForLecture } from "../services/examService";
import type { ExamTicket } from "../lib/types";
import { useLectureBySlug } from "../hooks/useLectureBySlug";
import { useAutosave } from "../hooks/useAutosave";
import { classifySaveError, readDraft, removeDraft, saveDraft } from "../lib/draftQueue";
import { setSaveStatus } from "../lib/saveStatus";
import { pb } from "../lib/pocketbase";
import { syncDrafts } from "../services/draftSync";
import NotFoundPage from "./NotFoundPage";
import { isNewUI } from "../lib/featureFlags";
import { useLectureFrame } from "../lib/lectureFrame";

import ErrorBanner from "../components/ErrorBanner";
import CardSkeleton from "../components/CardSkeleton";
import Editor from "../components/Editor";
import SpeechToText from "../components/SpeechToText";
import TagEditor from "../components/TagEditor";
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

  const { lecture, loading, error } = useLectureBySlug(
    lectureSlugParam ?? ""
  );
  const isCourseContext = !!courseSlug;
  const toast = useToast();

  const handleMakeTask = useCallback(
    (text: string) => {
      if (!lecture) return;
      const subjectId = lectureCourseId(lecture) || null;
      void createTaskFromLecture(text, lecture.id, subjectId)
        .then(() => toast.show("Задача добавлена", { label: "Открыть", onClick: () => navigate("/tasks") }))
        .catch(() => toast.show("Не удалось добавить задачу"));
    },
    [lecture, toast, navigate]
  );

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

  const frame = useLectureFrame();
  const {
    setTitle: setCrumbTitle,
    registerFlush,
    tocContainerRef,
    bumpToc,
    setSaveIndicator,
    tagsRequest,
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
    // Остался несохранённый текст (закрыли вкладку без связи или сессия истекла)?
    // Берём его, если он новее записи на сервере, и сразу пробуем отправить.
    const draft = readDraft(lecture.id);
    const useDraft = Boolean(draft && draft.ts > Date.parse(String(lecture.updated).replace(" ", "T")));
    const t = useDraft && draft ? draft.title : lectureTitle(lecture);
    // Токены `[[file:…]]` → абсолютные URL (чтобы картинки видел и TipTap).
    const c = resolveFileTokens(useDraft && draft ? draft.content : lectureBody(lecture), lecture);
    if (draft) {
      // Устаревший черновик (на сервере новее) не нужен, свежий — отправляем.
      if (useDraft) void syncDrafts();
      else removeDraft(lecture.id);
    }
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
      courseCoverSeed: course?.cover_seed,
      excerpt: lectureExcerpt(lecture, 140),
      savedAt: lecture.updated,
    });
  }, [lecture, isCourseContext, semesterSlug, courseSlug]);

  // ---- Автосохранение (title / content / tags) --------------------------
  const doSave = useCallback(async (): Promise<void | "queued"> => {
    if (!lecture) return;
    const draft = {
      id: lecture.id,
      title: titleRef.current.trim() || "Без названия",
      // Абсолютные URL картинок → портативные токены [[file:…]].
      content: tokenizePbFileUrls(contentRef.current, lecture),
      tags: tagsRef.current,
    };
    try {
      await updateLecture(draft.id, draft.title, draft.content, draft.tags);
      removeDraft(draft.id);
    } catch (e) {
      // Не вышло: текст остаётся на устройстве и уйдёт позже (B6, очередь).
      const kind = classifySaveError(e, pb.authStore.isValid);
      const kept = saveDraft(draft);
      if (kind === "session") return kept ? "queued" : void setSaveStatus("failed");
      if (kind === "offline" && kept) {
        setSaveStatus("offline");
        return "queued";
      }
      setSaveStatus("failed");
      throw e;
    }
  }, [lecture]);

  const { saveState, saveText, flush } = useAutosave({
    save: doSave,
    deps: [title, content, tags],
    enabled: ready,
  });

  // Название растёт по высоте и переносится по словам (раньше однострочное поле обрезало длинные названия).
  const titleRef2 = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = titleRef2.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title, ready]);
  useEffect(() => {
    const el = titleRef2.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === w) return;
      w = el.clientWidth;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  // Верхняя полоса (в каркасе) показывает «● Сохранено».
  useEffect(() => {
    if (!ready) return;
    setSaveIndicator({ state: saveState, text: saveText });
  }, [ready, saveState, saveText, setSaveIndicator]);
  useEffect(() => () => setSaveIndicator(null), [setSaveIndicator]);

  // «···» → «Теги»: окно с тегами (в самой лекции тегов нет, как в макете).
  const [tagsOpen, setTagsOpen] = useState(false);
  const seenTagsRequest = useRef(tagsRequest);
  useEffect(() => {
    if (tagsRequest !== seenTagsRequest.current) {
      seenTagsRequest.current = tagsRequest;
      setTagsOpen(true);
    }
  }, [tagsRequest]);

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

  const unassigned = lecture ? !lectureCourseId(lecture) : false;
  const isHtmlContent = !!(lecture && /<[a-z][\s\S]*>/i.test(content));
  const { readiness } = useLectureReadiness(lecture?.id);

  // Плашка «Нужна для N билетов» (spec раздел 8). Данные не влияют на
  // готовность. Нет связей → плашки нет вообще (не пустое состояние).
  const [linkedTickets, setLinkedTickets] = useState<ExamTicket[]>([]);
  useEffect(() => {
    if (!lecture?.id) {
      setLinkedTickets([]);
      return;
    }
    let cancelled = false;
    fetchTicketsForLecture(lecture.id)
      .then((ts) => {
        if (!cancelled) setLinkedTickets(ts);
      })
      .catch(() => {
        if (!cancelled) setLinkedTickets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lecture?.id]);

  // «Показать в конспекте» из квиза (spec 6.3): подсветить цитату 3 секунды,
  // если нашлась в статичном HTML; иначе просто открыть лекцию как есть.
  const highlightQuote = (location.state as { highlightQuote?: string } | null)
    ?.highlightQuote;
  useEffect(() => {
    if (!highlightQuote || mode !== "static" || !staticBodyRef.current) return;
    const root = staticBodyRef.current;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const needle = highlightQuote.trim().toLowerCase();
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent ?? "";
      const idx = text.toLowerCase().indexOf(needle.slice(0, 60));
      if (idx === -1) continue;
      const el = node.parentElement;
      if (!el) continue;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const prevBg = el.style.backgroundColor;
      el.style.backgroundColor = "var(--color-accent-soft, #FCE9DD)";
      el.style.transition = "background-color 0.3s";
      window.setTimeout(() => {
        el.style.backgroundColor = prevBg;
      }, 3000);
      break;
    }
    // Очищаем state, чтобы повторный рендер/назад не подсвечивал снова.
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightQuote, mode, content]);

  // Строка над названием и под ним (Screen-editor): «ПРЕДМЕТ · ЛЕКЦИЯ N», статус и даты.
  const course = lecture?.expand?.field;
  const eyebrow = [
    unassigned ? "Черновики" : course ? courseName(course) : "",
    lecture?.number ? `Лекция ${lecture.number}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const status = readiness && readiness.percent !== null ? lectureListStatus(readiness) : null;
  const lectureDay = lecture ? parsePbDate(lecture.lecture_date || lecture.created) : null;
  const metaText = [
    lectureDay ? lectureDateLabel(lectureDay) : "",
    readiness?.lastActivityAt ? repeatedAgoLabel(readiness.lastActivityAt) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // Лекцию удалили или доступа нет: сервер отвечает «не найдено» (экран 404, B6).
  const notFound =
    !lecture && !loading && isNewUI() && (!error || /not found|wasn't found|не найден|404/i.test(error));

  return (
    <>
      <main className="workspace-main" key={lectureSlugParam || "view"}>
        {notFound && <NotFoundPage embedded />}
        {error && !lecture && !notFound && (
          <ErrorBanner message={error || "Запись не найдена."} />
        )}
        {!lecture && !loading && !error && !notFound && (
          <div className="empty">Запись не найдена.</div>
        )}
        {!lecture && loading && <CardSkeleton />}

        {ready && (
          <article className="c-lecture">
            <header className="c-lecture-head">
              <p className="c-lecture-eyebrow">
                {eyebrow}
                {lectureDay && <span className="c-lecture-eyebrow-date"> · {lectureDateLabel(lectureDay)}</span>}
              </p>
              <textarea
                ref={titleRef2}
                rows={1}
                className="lecture-title-input"
                value={title}
                placeholder="Название записи"
                aria-label="Название лекции"
                onChange={(e) => updateTitle(e.target.value)}
                onKeyDown={(e) => {
                  // Название в одну «строку» по смыслу: Enter не ставит перенос, а уходит в текст.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                    document.querySelector<HTMLElement>(".tiptap-editor")?.focus();
                  }
                }}
              />
              <p className="c-lecture-meta">
                {status && <StatusChip tone={status.tone}>{status.label}</StatusChip>}
                <span>{metaText}</span>
              </p>
            </header>

            <LinkedTicketsPlaque tickets={linkedTickets} />

            <div ref={contentWrapRef} className="c-lecture-body">
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
                    onMakeTask={handleMakeTask}
                    onQuiz={() => navigate(`/quiz/${lecture.id}`)}
                  />
                  {/* Речь + аудиозапись: регистрирует запись в SpeechProvider. */}
                  <SpeechToText lecture={lecture} onUpload={handleUploadImages} />
                </>
              )}
            </div>
          </article>
        )}
      </main>

      <Modal open={tagsOpen} onClose={() => setTagsOpen(false)} title="Теги">
        <TagEditor selectedIds={tags} onChange={updateTags} />
      </Modal>
    </>
  );
}

export default LectureView;
