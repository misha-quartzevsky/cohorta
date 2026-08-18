/**
 * ============================================
 *  LectureEdit.tsx — Редактирование лекции
 * ============================================
 *
 * Workspace layout с автосохранением: заголовок, теги и
 * контент сохраняются в PocketBase с debounce (~1.2 с).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import type { Lecture } from "../lib/types";
import {
  courseName,
  lectureBody,
  lectureCourseId,
  lectureTitle,
  tagLectureIds,
} from "../lib/types";
import {
  fetchLectureBySlug,
  tokenizePbFileUrls,
  resolveFileTokens,
  updateLecture,
  uploadLectureImages,
} from "../services/lectureService";
import { fetchTags } from "../services/tagService";
import { useLectures } from "../hooks/useLectures";

import Header, { type Crumb } from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import Editor from "../components/Editor";
import LectureSidebar from "../components/LectureSidebar";
import TableOfContents from "../components/TableOfContents";
import TagEditor from "../components/TagEditor";

type SaveState = "idle" | "saving" | "saved" | "error";

function LectureEdit() {
  const {
    semesterSlug,
    courseSlug,
    lectureSlug: lectureSlugParam,
  } = useParams();
  const navigate = useNavigate();

  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const titleRef = useRef("");
  const contentRef = useRef("");
  const tagsRef = useRef<string[]>([]);
  const firstRun = useRef(true);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);

  const isCourseContext = !!courseSlug;
  const { course, lectures } = useLectures(courseSlug || "");

  // Initial load: lecture + its tags.
  useEffect(() => {
    if (!lectureSlugParam) return;
    let cancelled = false;
    fetchLectureBySlug(lectureSlugParam)
      .then(async (rec) => {
        if (cancelled) return;
        setLecture(rec);
        const t = lectureTitle(rec);
        // Токены `[[file:…]]` → абсолютные URL (чтобы картинки видел и TipTap).
        const c = resolveFileTokens(lectureBody(rec), rec);
        titleRef.current = t;
        contentRef.current = c;
        setTitle(t);
        setContent(c);
        try {
          const all = await fetchTags();
          if (!cancelled) {
            const ids = all
              .filter((tg) => tagLectureIds(tg).includes(rec.id))
              .map((tg) => tg.id);
            tagsRef.current = ids;
            setTags(ids);
          }
        } catch (e) {
          console.error("Ошибка загрузки тегов:", e);
        }
        if (!cancelled) {
          firstRun.current = true;
          setLoaded(true);
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
      });
    return () => {
      cancelled = true;
    };
  }, [lectureSlugParam]);

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
  const crumbs: Crumb[] =
    isCourseContext && course
      ? [
          { label: "Рабочий стол", to: `/s/${semesterSlug}` },
          {
            label: courseName(course),
            to: `/s/${semesterSlug}/${courseSlug}`,
          },
          { label: title || "Редактирование" },
        ]
      : [
          { label: "Рабочий стол", to: `/s/${semesterSlug}` },
          { label: title || "Редактирование" },
        ];

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
            onBack={() => void goAfterSave(`/s/${semesterSlug}/${courseSlug}`)}
          />
        )}

        <main className="workspace-main">
          <div className="lecture-card">
            <div className="edit-meta-row">
              <p className="lecture-card-meta">
                {unassigned ? "Заметка" : "Лекция"} ·{" "}
                {new Date(lecture.created).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
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
