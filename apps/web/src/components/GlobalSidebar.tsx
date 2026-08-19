/**
 * ============================================
 *  GlobalSidebar.tsx — Fixed left navigation panel
 * ============================================
 *
 * Persistent glass sidebar visible on all protected pages:
 *  - User profile (avatar, name, email, logout)
 *  - Semester switcher (current semester + popup)
 *  - НЕДАВНИЕ section (last 3 lectures/notes)
 *  - ЗАМЕТКИ section (unassigned notes link)
 *
 * Context-aware: when on a lecture page, shows:
 *  - Last 3 lectures of the course
 *  - Table of Contents of current lecture
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogOut, ChevronDown, X } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { useSemester } from "../lib/semesterContext";
import { useRecentLectures } from "../hooks/useRecentLectures";
import { useLectures } from "../hooks/useLectures";
import { useLectureFrame } from "../lib/lectureFrame";
import { pb } from "../lib/pocketbase";
import type { User, Semester } from "../lib/types";
import {
  semesterSlug,
  lectureSlug,
  lectureTitle,
  lectureCourseId,
} from "../lib/types";
import TableOfContents from "./TableOfContents";
import ScrollBar from "./scrollbar/ScrollBar";

/** Display name of the user (falls back to the email). */
function userName(user: User): string {
  const name = user.name ? String(user.name).trim() : "";
  return name || user.email || "Пользователь";
}

/** First letter of the name used as the avatar fallback. */
function userInitial(user: User): string {
  return userName(user).charAt(0).toUpperCase();
}

/** Avatar photo URL ("" when the user has no avatar file). */
function avatarSrc(user: User): string {
  if (!user.avatar) return "";
  return pb.files.getURL(user, user.avatar);
}

/** Check if current route is a lecture page */
function isLectureRoute(pathname: string): {
  isLecture: boolean;
  courseSlug?: string;
  semesterSlug?: string;
} {
  // Match /s/:semester/:course/:lecture or /s/:semester/:course/:lecture/edit
  const match = pathname.match(/^\/s\/([^/]+)\/([^/]+)\/([^/]+)/);
  if (match) {
    return {
      isLecture: true,
      semesterSlug: match[1],
      courseSlug: match[2],
    };
  }
  return { isLecture: false };
}

interface Props {
  /** Mobile drawer open flag (ignored on desktop — the sidebar is always
   *  visible there and the CSS `.open` class has no effect). */
  open?: boolean;
  /** Called when the drawer should close (backdrop click / close button /
   *  navigation). */
  onClose?: () => void;
}

export default function GlobalSidebar({ open = false, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { current, semesters } = useSemester();
  const [semesterPopupOpen, setSemesterPopupOpen] = useState(false);
  const [popupTop, setPopupTop] = useState(0);
  const semesterBtnRef = useRef<HTMLButtonElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const semesterPopupRef = useRef<HTMLDivElement | null>(null);
  const prevPathRef = useRef(location.pathname);

  // Close the mobile drawer whenever the route changes (user tapped a nav
  // link). Tracked via prev/current path so simply OPENING the drawer (no
  // navigation) never triggers a close.
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      onClose?.();
    }
  }, [location.pathname, onClose]);

  // Lock the background scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const { lectures: recentLectures } = useRecentLectures(3);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleSemesterSelect = (sem: Semester) => {
    setSemesterPopupOpen(false);
    navigate(`/s/${semesterSlug(sem)}`);
  };

  const toggleSemesterPopup = () => {
    // Anchor the overlay near its trigger button. The popup is portaled to
    // document.body — the sidebar's backdrop-filter would otherwise turn
    // position:fixed into a sidebar-relative box that overflows the sidebar
    // and adds horizontal scroll.
    if (!semesterPopupOpen && semesterBtnRef.current) {
      const rect = semesterBtnRef.current.getBoundingClientRect();
      setPopupTop(rect.bottom + 8);
    }
    setSemesterPopupOpen((open) => !open);
  };

  const avatar = user ? avatarSrc(user) : "";

  // Determine if we're on a lecture page
  const { isLecture, courseSlug: currentCourseSlug, semesterSlug: currentSemSlug } = isLectureRoute(location.pathname);

  // Fetch lectures of current course if on lecture page
  const { lectures: courseLectures, course } = useLectures(
    isLecture && currentCourseSlug ? currentCourseSlug : "",
    isLecture
  );

  // TOC data comes from the LectureFrame context, provided by <AppLayout/>
  // (available on every protected page, including lectures).
  const { tocContainerRef, tocVersion } = useLectureFrame();

  return (
    <>
      {open && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
          role="presentation"
        />
      )}
      <aside
        ref={sidebarRef}
        className={`global-sidebar${open ? " open" : ""}`}
      >
        {/* Close button — only shown on mobile (drawer mode). */}
        <button
          type="button"
          className="sidebar-close"
          onClick={onClose}
          aria-label="Закрыть меню"
        >
          <X size={18} />
        </button>

        {/* User Profile */}
      {user && (
        <div className="sidebar-profile">
          <div className="profile-avatar">
            {avatar ? (
              <img className="profile-avatar-img" src={avatar} alt="" />
            ) : (
              <span className="profile-avatar-initial">{userInitial(user)}</span>
            )}
          </div>
          <div className="profile-info">
            <span className="profile-name">{userName(user)}</span>
            <span className="profile-email">{user.email}</span>
          </div>
          <button
            type="button"
            className="profile-logout"
            onClick={handleLogout}
            title="Выйти"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}

      {/* Semester Switcher */}
      {current && !isLecture && (
        <div className="sidebar-semester">
          <button
            ref={semesterBtnRef}
            type="button"
            className="sidebar-semester-btn"
            onClick={toggleSemesterPopup}
          >
            <span className="sidebar-semester-current">
              {semesterSlug(current)} семестр
            </span>
            <ChevronDown size={16} className={semesterPopupOpen ? "rotate" : ""} />
          </button>
        </div>
      )}

      {/* Semester popup — portaled to document.body so it renders ON TOP of the
          sidebar (the sidebar's backdrop-filter would otherwise make the popup's
          position:fixed sidebar-relative → it drifted past the edge and added
          horizontal scroll instead of overlaying). */}
      {semesterPopupOpen &&
        current &&
        createPortal(
          <>
            <div
              className="sidebar-semester-backdrop"
              onClick={() => setSemesterPopupOpen(false)}
            />
            <div
              ref={semesterPopupRef}
              className="sidebar-semester-popup"
              style={{ top: popupTop }}
            >
              {semesters.map((sem) => (
                <button
                  key={sem.id}
                  type="button"
                  className={`sidebar-semester-item${
                    sem.id === current.id ? " active" : ""
                  }`}
                  onClick={() => handleSemesterSelect(sem)}
                >
                  {semesterSlug(sem)} семестр
                </button>
              ))}
              <ScrollBar scrollRef={semesterPopupRef} />
            </div>
          </>,
          document.body
        )}

      {/* Context-aware content */}
      {isLecture ? (
        <>
          {/* Course lectures section */}
          {course && (
            <nav className="sidebar-section">
              <button
                type="button"
                className="sidebar-back-btn"
                onClick={() => navigate(`/s/${currentSemSlug}/${currentCourseSlug}`)}
              >
                ← Назад к курсу
              </button>
              <h3 className="sidebar-section-title">ЛЕКЦИИ КУРСА</h3>
              <ul className="sidebar-nav sidebar-nav-scrollable">
                {courseLectures.map((lec) => {
                  const slug = lectureSlug(lec);
                  const to = `/s/${currentSemSlug}/${currentCourseSlug}/${slug}`;
                  const isActive = location.pathname.startsWith(to);
                  return (
                    <li key={lec.id}>
                      <Link
                        to={to}
                        className={`sidebar-nav-item${isActive ? " active" : ""}`}
                      >
                        {lectureTitle(lec)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          {/* Table of Contents */}
          <nav className="sidebar-section">
            <h3 className="sidebar-section-title">ОГЛАВЛЕНИЕ</h3>
            {tocContainerRef && tocVersion !== undefined ? (
              <TableOfContents containerRef={tocContainerRef} version={tocVersion} hideTitle />
            ) : (
              <div className="sidebar-toc-placeholder">
                <p style={{ fontSize: '0.85rem', color: 'var(--c-muted)', padding: '0.5rem 0.75rem' }}>
                  Загрузка...
                </p>
              </div>
            )}
          </nav>
        </>
      ) : (
        <>
          {/* Section: НЕДАВНИЕ (last 3 lectures) */}
          <nav className="sidebar-section">
            <h3 className="sidebar-section-title">НЕДАВНИЕ</h3>
            <ul className="sidebar-nav">
              {recentLectures.map((lec) => {
                const unassigned = !lectureCourseId(lec);
                const slug = lectureSlug(lec);
                let to: string;
                
                if (unassigned) {
                  to = `/note/${slug}`;
                } else {
                  // Get course from expanded data or fallback
                  const expandedCourse = lec.expand?.field;
                  const cSlug = expandedCourse?.slug || expandedCourse?.id || "unknown";
                  // Resolve the semester slug WITHOUT assuming `current` is non-null:
                  // current is null on non-semester routes (/notes) and right after
                  // login / while the semester list is still loading. Calling
                  // semesterSlug(current!) with null crashed and blanked the screen.
                  let semSlug = currentSemSlug || (current ? semesterSlug(current) : "");
                  if (!semSlug && expandedCourse?.semesters) {
                    const sem = semesters.find((s) => s.id === expandedCourse.semesters);
                    if (sem) semSlug = semesterSlug(sem);
                  }
                  to = semSlug ? `/s/${semSlug}/${cSlug}/${slug}` : `/note/${slug}`;
                }
                
                return (
                  <li key={lec.id}>
                    <Link to={to} className="sidebar-nav-item">
                      {lectureTitle(lec)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Section: ЗАМЕТКИ */}
          <nav className="sidebar-section">
            <h3 className="sidebar-section-title">ЗАМЕТКИ</h3>
            <ul className="sidebar-nav">
              <li>
                <Link to="/notes" className="sidebar-nav-item">
                  Все заметки
                </Link>
              </li>
            </ul>
          </nav>
        </>
      )}
      <ScrollBar scrollRef={sidebarRef} />
      </aside>
    </>
  );
}
