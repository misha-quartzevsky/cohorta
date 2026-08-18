import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import {
  courseName,
  lectureBody,
  lectureCourseId,
  lectureTitle,
  tagLectureIds,
} from "../lib/types";
import { formatDate } from "../lib/format";
import {
  tokenizePbFileUrls,
  resolveFileTokens,
  updateLecture,
  uploadLectureImages,
} from "../services/lectureService";
import { fetchTags } from "../services/tagService";
import { useLectures } from "../hooks/useLectures";
import { useLectureBySlug } from "../hooks/useLectureBySlug";
import { lectureCrumbs } from "../lib/lectureCrumbs";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import Editor from "../components/Editor";
import SpeechToText from "../components/SpeechToText";
import LectureSidebar from "../components/LectureSidebar";
import TableOfContents from "../components/TableOfContents";
import TagEditor from "../components/TagEditor";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * LectureEdit — редактирование лекции с автосохранением.
 * Заголовок, теги и контент сохраняются в PocketBase с debounce (~1.2 с).
 */
function LectureEdit() {
  const { semesterSlug, courseSlug, lectureSlug: lectureSlugParam } =
    useParams();
  const navigate = useNavigate();

  const { lecture, error } = useLectureBySlug(lectureSlugParam ?? "");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loaded, setLoaded] = useState(false);

  const titleRef = useRef("");
  const contentRef = useRef("");
  const tagsRef = useRef<string[]>([]);
  const firstRun = useRef(true);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);

  const isCourseContext = !!courseSlug;
  const { course, lectures } = useLectures(courseSlug || "");

  // Initialize editor fields + tags when the lecture resolves.
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
        if (!cancelled) {
          firstRun.current = true;
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lecture]);

  const doSave = useCallback(async () => {
    if (!lecture) return;
    try {
      await updateLecture(
        lecture.id,
        titleRef.current.trim() || "Без названия",
        // Абсолютные URL картинок → портативные токены [[file:…]],
        // чтобы в БД жили имена файлов, а не «пришитые» к хосту ссылки.
        tokenizePbFileUrls(contentRef.current, lecture),
        tagsRef.current
      );
      setSaveState("saved");
    } catch (e) {
      console.error("Ошибка автосохранения:", e);
      setSaveState("error");
    }
  }, [lecture]);

  // Debounced autosave on title/content/tags changes.
  useEffect(() => {
    if (!loaded) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(() => {
      void doSave();
    }, 1200);
    return () => clearTimeout(timer);
  }, [title, content, tags, loaded, doSave]);

  // «Обновлено только что» → «Сохранено».
  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), 3000);
    return () => clearTimeout(timer);
  }, [saveState]);

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

  // Загрузка картинок в поле `file` лекции (для Editor'а).
  const handleUploadImages = useCallback(
    async (files: File[]) => {
      if (!lecture) {
        throw new Error("Лекция ещё не создана — сохраните её первым делом.");
      }
      return uploadLectureImages(lecture, files);
    },
    [lecture]
  );

  // Flush pending changes, then navigate.
  const goAfterSave = async (target: string) => {
    try {
      await doSave();
    } catch {
      /* keep going */
    }
    navigate(target);
  };

  if (error) {
    return (
      <>
        <Header crumbs={[{ label: "Рабочий стол" }]} />
        <div className="page">
          <ErrorBanner message={error} />
        </div>
      </>
    );
  }

  if (!lecture || !loaded) return <LoadingState />;

  const unassigned = !lectureCourseId(lecture);
  const crumbs = lectureCrumbs({
    semesterSlug,
    course: isCourseContext ? course : null,
    courseSlug,
    title,
    finalFallback: "Редактирование",
  });

  const saveText =
    saveState === "saving"
      ? "Сохранение…"
      : saveState === "saved"
        ? "Обновлено только что"
        : saveState === "error"
          ? "Ошибка сохранения"
          : "Сохранено";

  return (
    <>
      <Header crumbs={crumbs} />
      <div className="page">

        <div className={`workspace${isCourseContext ? "" : " no-sidebar"}`}>
          {isCourseContext && (
            <LectureSidebar
              courseName={course ? courseName(course) : "Курс"}
              lectures={lectures}
              activeSlug={lectureSlugParam || ""}
              onSelect={(slug) =>
                void goAfterSave(`/s/${semesterSlug}/${courseSlug}/${slug}`)
              }
              onBack={() =>
                void goAfterSave(`/s/${semesterSlug}/${courseSlug}`)
              }
            />
          )}

          <main className="workspace-main">
            <div className="lecture-card">
              <div className="edit-meta-row">
                <p className="lecture-card-meta">
                  {unassigned ? "Заметка" : "Лекция"} ·{" "}
                  {formatDate(lecture.created)}
                </p>
                <span className={`save-indicator ${saveState}`}>
                  {saveState === "saving" && (
                    <Loader2 size={14} className="spin" />
                  )}
                  {saveText}
                </span>
              </div>
              <input
                className="lecture-title-input"
                value={title}
                placeholder="Название лекции"
                onChange={(e) => updateTitle(e.target.value)}
              />
              <TagEditor selectedIds={tags} onChange={updateTags} />
              <div ref={contentAreaRef} className="lecture-card-body">
                <Editor
                  value={content}
                  onUpdate={updateContent}
                  className="editor-inline"
                  onUploadImages={handleUploadImages}
                />
                {/* Речь + аудиозапись: регистрирует лекцию в SpeechProvider. */}
                <SpeechToText
                  lecture={lecture}
                  onUpload={handleUploadImages}
                />
              </div>
            </div>
          </main>

          <aside className="workspace-toc">
            <TableOfContents containerRef={contentAreaRef} version={content} />
          </aside>
        </div>
      </div>
    </>
  );
}

export default LectureEdit;
