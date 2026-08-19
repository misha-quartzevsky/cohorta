/**
 * ============================================
 *  LectureLayout.tsx — persistent lecture frame
 * ============================================
 *
 * Layout route that mounts the Header, the course lecture sidebar and the
 * three-column workspace grid ONCE, then keeps them mounted while the user
 * switches between lecture view / edit — only the white card (the <Outlet/>)
 * is swapped. This removes the full-screen loading-state flicker that used to
 * happen when the sidebar/header unmounted on every lecture change.
 *
 * The pages rendered by <Outlet/> communicate with the frame through the
 * LectureFrame context (breadcrumb title + pending-save flush).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import Header from "./Header";
import LectureSidebar from "./LectureSidebar";
import { useLectures } from "../hooks/useLectures";
import { courseName } from "../lib/types";
import { lectureCrumbs } from "../lib/lectureCrumbs";
import { LectureFrameContext } from "../lib/lectureFrame";

export default function LectureLayout() {
  const { semesterSlug, courseSlug, lectureSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isCourseContext = !!courseSlug;
  const isEdit = location.pathname.endsWith("/edit");

  // Course + its lectures power the persistent sidebar.
  const { course, lectures } = useLectures(courseSlug || "");

  // Breadcrumb title — kept here so the Header can stay in the layout.
  const [title, setTitle] = useState("");
  // Flush registered by the edit page (pending autosave before navigation).
  const flushRef = useRef<(() => Promise<void>) | null>(null);

  const registerFlush = useCallback(
    (fn: (() => Promise<void>) | null) => {
      flushRef.current = fn;
    },
    []
  );
  const setTitleCb = useCallback((t: string) => setTitle(t), []);

  const api = useMemo(
    () => ({ registerFlush, setTitle: setTitleCb }),
    [registerFlush, setTitleCb]
  );

  /** Flush any pending save (edit page), then navigate. */
  const go = useCallback(
    (target: string) => {
      const flush = flushRef.current;
      if (!flush) {
        navigate(target);
        return;
      }
      void flush().then(() => navigate(target));
    },
    [navigate]
  );

  const onSelect = useCallback(
    (slug: string) => {
      const base = `/s/${semesterSlug}/${courseSlug}/${slug}`;
      go(isEdit ? `${base}/edit` : base);
    },
    [semesterSlug, courseSlug, isEdit, go]
  );

  const onBack = useCallback(() => {
    go(`/s/${semesterSlug}/${courseSlug}`);
  }, [semesterSlug, courseSlug, go]);

  // When the target lecture changes, drop the stale breadcrumb title.
  // The page re-sets it (via context) once the new record loads.
  useEffect(() => {
    setTitle("");
  }, [lectureSlug, setTitleCb]);

  const crumbs = lectureCrumbs({
    semesterSlug,
    course,
    courseSlug,
    title,
    finalFallback: isEdit ? "Редактирование" : "Запись",
  });

  return (
    <LectureFrameContext.Provider value={api}>
      <Header crumbs={crumbs} crumbsLoading={title === ""} />
      <div className="page">
        <div className={`workspace${isCourseContext ? "" : " no-sidebar"}`}>
          {isCourseContext && (
            <LectureSidebar
              courseName={course ? courseName(course) : "Курс"}
              lectures={lectures}
              activeSlug={lectureSlug || ""}
              onSelect={onSelect}
              onBack={onBack}
            />
          )}
          <Outlet />
        </div>
      </div>
    </LectureFrameContext.Provider>
  );
}
