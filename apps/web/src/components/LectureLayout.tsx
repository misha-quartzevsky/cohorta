/**
 * ============================================
 *  LectureLayout.tsx — persistent lecture frame
 * ============================================
 *
 * Layout route that mounts the Header ONCE, then keeps it mounted while the user
 * switches between lecture view / edit — only the white card (the <Outlet/>)
 * is swapped. This removes the full-screen loading-state flicker that used to
 * happen when the sidebar/header unmounted on every lecture change.
 *
 * The pages rendered by <Outlet/> communicate with the frame through the
 * LectureFrame context (breadcrumb title + TOC data + pending-save flush).
 *
 * Note: Old LectureSidebar removed — GlobalSidebar handles lecture navigation.
 * The frame context itself is owned by <AppLayout/> (so GlobalSidebar can read
 * the TOC data too); this layout is a consumer.
 */

import { useEffect } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";

import Header from "./Header";
import { useLectures } from "../hooks/useLectures";
import { lectureCrumbs } from "../lib/lectureCrumbs";
import { useLectureFrame } from "../lib/lectureFrame";
import { lastSemesterSlug } from "../lib/lastSemester";

export default function LectureLayout() {
  const { semesterSlug, courseSlug, lectureSlug } = useParams();
  const location = useLocation();

  const isEdit = location.pathname.endsWith("/edit");

  // Course for breadcrumbs
  const { course } = useLectures(courseSlug || "");

  // Frame state lives in <AppLayout/>; here we only read it.
  const { title, setTitle, bumpToc } = useLectureFrame();

  // When the target lecture changes, drop the stale breadcrumb title and bump
  // TOC version so the sidebar TOC re-scans the (new) content container.
  useEffect(() => {
    setTitle("");
    bumpToc();
  }, [lectureSlug, setTitle, bumpToc]);

  // «Рабочий стол» breadcrumb: lecture routes carry the semester in the URL,
  // but note routes (`/note/...`) don't — there we fall back to the last
  // semester the user worked in, so the dashboard reopens that semester.
  const crumbSemSlug = semesterSlug || lastSemesterSlug();

  const crumbs = lectureCrumbs({
    semesterSlug: crumbSemSlug,
    course,
    courseSlug,
    title,
    finalFallback: isEdit ? "Редактирование" : "Запись",
  });

  return (
    <>
      <Header crumbs={crumbs} crumbsLoading={title === ""} />
      <div className="page">
        <div className="workspace-simple">
          <Outlet />
        </div>
      </div>
    </>
  );
}
