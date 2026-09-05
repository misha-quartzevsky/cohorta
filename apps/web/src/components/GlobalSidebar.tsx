/**
 * ============================================
 *  GlobalSidebar.tsx — Fixed left navigation panel
 * ============================================
 *
 * Структура по DESIGN.md §7.1 — ровно один источник правды на каждый список:
 *  1. Логотип
 *  2. Переключатель семестра (виден всегда, включая страницы лекций и заметок)
 *  3. Поиск
 *  4. Глобальная навигация: Рабочий стол · Все заметки · Карточки · Экзамены
 *  5. Дерево курсов: точка-градиент + название + счётчик, раскрывается
 *     отдельным шевроном (клик по названию всегда ведёт на курс).
 *     Последняя ветка — «Без курса»: незакреплённые заметки.
 *  6. Оглавление — только на странице лекции/заметки
 *  7. Профиль — внизу, второстепенный вес
 *
 * Между поиском и профилем всё живёт в одной скроллируемой области
 * (`.sidebar-scroll`): каркас статичен, профиль не выдавливается за экран,
 * сколько бы ни было курсов.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
  Home,
  FileText,
  Layers,
  Calendar,
  GraduationCap,
  Users,
  Search,
} from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { useSemester } from "../lib/semesterContext";
import { useRecentLectures } from "../hooks/useRecentLectures";
import { useLectures } from "../hooks/useLectures";
import { useLectureSearch } from "../hooks/useLectureSearch";
import { useCourses } from "../hooks/useCourses";
import { useLectureFrame } from "../lib/lectureFrame";
import { useExam } from "../hooks/useExam";
import { pb } from "../lib/pocketbase";
import { lastSemesterSlug } from "../lib/lastSemester";
import { courseGradient } from "../lib/courseGradient";
import { parsePbDate, formatDate } from "../lib/format";
import type { User, Semester } from "../lib/types";
import {
  semesterSlug,
  lectureSlug,
  lectureTitle,
  lectureCourseId,
  courseName,
  courseSlug,
  courseColor,
  ticketStatus,
  isPremiumActive,
} from "../lib/types";
import TableOfContents from "./TableOfContents";
import ScrollBar from "./scrollbar/ScrollBar";
import ModeToggle from "./ModeToggle";
import { useMode } from "../lib/modeContext";

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

/** Route is a lecture page: /s/:semester/:course/:lecture(/edit). */
function isLectureRoute(pathname: string): {
  isLecture: boolean;
  courseSlug?: string;
  semesterSlug?: string;
} {
  const match = pathname.match(/^\/s\/([^/]+)\/([^/]+)\/([^/]+)/);
  if (match) {
    return { isLecture: true, semesterSlug: match[1], courseSlug: match[2] };
  }
  return { isLecture: false };
}

/** Route is an unassigned-note page. `/note/new` is deliberately excluded:
 *  there is no content to build a table of contents from yet. */
function isNoteRoute(pathname: string): boolean {
  return /^\/note\/[^/]+(\/edit)?$/.test(pathname);
}

/**
 * Строка «Экзамен» внутри раскрытой ветки курса. Отдельный компонент,
 * а не инлайн-фетч в родителе: монтируется только когда ветка открыта
 * (см. вызов ниже), поэтому запрос экзамена идёт максимум для одного
 * курса за раз, а не для всех курсов дерева сразу.
 */
function CourseExamRow({ courseId, to }: { courseId: string; to: string }) {
  const { exam, tickets } = useExam(courseId, true);
  if (!exam) return null;
  const ready = tickets.filter((t) => ticketStatus(t) === "ready").length;
  return (
    <li>
      <Link to={to} className="sidebar-note-row sidebar-exam-row">
        <GraduationCap size={13} />
        <span>Экзамен</span>
        <span className="sidebar-exam-count">
          {ready}/{tickets.length}
        </span>
      </Link>
    </li>
  );
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
  const { isGroup } = useMode();
  const { current, semesters } = useSemester();
  const [semesterPopupOpen, setSemesterPopupOpen] = useState(false);
  const [popupTop, setPopupTop] = useState(0);
  /** Явно свёрнутые/раскрытые курсы. Ключ — id курса (или "" для «Без курса»);
   *  отсутствие ключа = состояние по умолчанию (раскрыт активный). */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const semesterBtnRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
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

  // Достаточно широкое окно, чтобы дерево курсов и «Без курса» показывали
  // все записи; сам список скроллится внутри `.sidebar-scroll`.
  const { lectures: recentLectures } = useRecentLectures(100);

  // Семестр для ссылок навигации. На /notes, /note/…, /decks `current` пуст —
  // берём последний рабочий (SemesterProvider пишет его на каждом /s/…).
  const homeSemSlug = current ? semesterSlug(current) : lastSemesterSlug() || "1";

  // Запись семестра для карточки-переключателя: на не-семестровых маршрутах
  // ищем её по слагу, чтобы контекст не исчезал (раньше кнопка просто пропадала).
  const activeSemester = useMemo(
    () =>
      current ??
      semesters.find((s) => semesterSlug(s) === homeSemSlug) ??
      null,
    [current, semesters, homeSemSlug]
  );

  const [sidebarQuery, setSidebarQuery] = useState("");
  const { results: sidebarResults, loading: sidebarLoading } =
    useLectureSearch(sidebarQuery, sidebarQuery.trim().length >= 2);
  // На не-семестровых маршрутах (/decks, /notes) `current` пуст — берём
  // activeSemester (фолбэк на последний рабочий семестр), иначе дерево
  // курсов пустеет, хотя переключатель семестра остаётся на месте.
  const { courses: semesterCourses } = useCourses(activeSemester?.id ?? "");

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
    // document.body so it overlays the content instead of widening the sidebar.
    if (!semesterPopupOpen && semesterBtnRef.current) {
      const rect = semesterBtnRef.current.getBoundingClientRect();
      setPopupTop(rect.bottom + 8);
    }
    setSemesterPopupOpen((prev) => !prev);
  };

  const avatar = user ? avatarSrc(user) : "";

  // Active state for the global nav links.
  const isDashboardRoute = /^\/s\/[^/]+$/.test(location.pathname);
  const isNotesRoute = location.pathname === "/notes";
  const isDecksRoute = location.pathname.startsWith("/decks");
  const isExamsRoute = /^\/s\/[^/]+\/exams$/.test(location.pathname);
  const isGroupRoute = /^\/s\/[^/]+\/group$/.test(location.pathname);

  const {
    isLecture,
    courseSlug: currentCourseSlug,
    semesterSlug: currentSemSlug,
  } = isLectureRoute(location.pathname);
  const isNote = isNoteRoute(location.pathname);

  // Незакреплённые заметки — ветка «Без курса» того же дерева.
  const unassignedNotes = recentLectures.filter((lec) => !lectureCourseId(lec));

  // Активный курс (для подсветки и авто-раскрытия ветки).
  const { course } = useLectures(
    isLecture && currentCourseSlug ? currentCourseSlug : "",
    isLecture
  );

  // TOC data comes from the LectureFrame context, provided by <AppLayout/>.
  const { tocContainerRef, tocVersion } = useLectureFrame();

  const semSlugForLinks = currentSemSlug || homeSemSlug;

  /** Одна ветка дерева: строка курса + вложенные записи. */
  const renderBranch = (
    key: string,
    name: string,
    to: string,
    dotStyle: string | null,
    notes: typeof recentLectures,
    noteHref: (slug: string) => string,
    autoOpen: boolean,
    courseId?: string
  ) => {
    const isOpen = expanded[key] ?? autoOpen;
    return (
      <li key={key || "unassigned"} className="sidebar-course">
        <div className={"sidebar-course-row" + (isOpen ? " open" : "")}>
          <button
            type="button"
            className="sidebar-course-toggle"
            aria-expanded={isOpen}
            aria-label={isOpen ? `Свернуть ${name}` : `Раскрыть ${name}`}
            onClick={() => setExpanded((p) => ({ ...p, [key]: !isOpen }))}
          >
            <ChevronRight size={13} className={isOpen ? "rotate" : ""} />
          </button>
          <Link to={to} className="sidebar-course-link">
            <span
              className="sidebar-course-dot"
              style={
                dotStyle
                  ? { background: dotStyle }
                  : { background: "var(--border-strong)" }
              }
            />
            <span className="sidebar-course-name">{name}</span>
          </Link>
          <span className="sidebar-course-count">{notes.length}</span>
        </div>
        {isOpen && (notes.length > 0 || courseId) && (
          <ul className="sidebar-course-notes">
            {courseId && <CourseExamRow courseId={courseId} to={`${to}/exam`} />}
            {notes.map((lec) => {
              const href = noteHref(lectureSlug(lec));
              return (
                <li key={lec.id}>
                  <Link
                    to={href}
                    className={
                      "sidebar-note-row" +
                      (location.pathname === href ||
                      location.pathname === `${href}/edit`
                        ? " active"
                        : "")
                    }
                  >
                    {lectureTitle(lec)}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

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
      <aside className={`global-sidebar${open ? " open" : ""}`}>
        {/* Close button — only shown on mobile (drawer mode). */}
        <button
          type="button"
          className="sidebar-close"
          onClick={onClose}
          aria-label="Закрыть меню"
        >
          <X size={18} />
        </button>

        {/* 1. Логотип */}
        <div className="sidebar-logo">
          <img
            className="sidebar-logo-img"
            src="/cohorta-black.svg"
            alt="Cohorta"
          />
        </div>

        {/* 1.5. Переключатель Соло / Группа — сразу под логотипом */}
        <ModeToggle />

        {/* 2. Переключатель семестра — виден на всех маршрутах */}
        {activeSemester && (
          <div className="sidebar-semester">
            <button
              ref={semesterBtnRef}
              type="button"
              className="sidebar-semester-btn"
              onClick={toggleSemesterPopup}
            >
              <Calendar size={16} />
              <span className="sidebar-semester-current">
                {semesterSlug(activeSemester)} семестр
              </span>
              <ChevronDown
                size={14}
                className={semesterPopupOpen ? "rotate" : ""}
              />
            </button>
          </div>
        )}

        {/* 3. Поиск */}
        <div className="sidebar-search">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              value={sidebarQuery}
              onChange={(e) => setSidebarQuery(e.target.value)}
              placeholder="Найти заметку"
              aria-label="Найти заметку"
            />
            {sidebarLoading && <span className="search-loading">…</span>}
          </div>
          {sidebarQuery.trim().length >= 2 && (
            <div className="sidebar-search-dropdown">
              {sidebarResults.length === 0 ? (
                <div className="sidebar-search-empty">Ничего не найдено</div>
              ) : (
                sidebarResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="sidebar-search-item"
                    onClick={() => {
                      navigate(r.to);
                      setSidebarQuery("");
                      onClose?.();
                    }}
                  >
                    {r.title}
                    {r.courseName && (
                      <span className="course">{r.courseName}</span>
                    )}
                    {r.snippet && <span className="snippet">{r.snippet}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Semester popup — portaled to document.body so it overlays the
            content (the sidebar's own stacking context would clip it). */}
        {semesterPopupOpen &&
          activeSemester &&
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
                      sem.id === activeSemester.id ? " active" : ""
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

        {/* Всё между поиском и профилем скроллится внутри одной области */}
        <div className="sidebar-scroll" ref={scrollRef}>
          {/* 4. Глобальная навигация (без заголовка — три пункта говорят сами) */}
          <nav className="sidebar-section">
            <ul className="sidebar-nav">
              <li>
                <Link
                  to={`/s/${homeSemSlug}`}
                  className={`sidebar-nav-item${
                    isDashboardRoute ? " active" : ""
                  }`}
                >
                  <Home size={16} />
                  <span>Рабочий стол</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/notes"
                  className={`sidebar-nav-item${isNotesRoute ? " active" : ""}`}
                >
                  <FileText size={16} />
                  <span>Все заметки</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/decks"
                  className={`sidebar-nav-item${isDecksRoute ? " active" : ""}`}
                >
                  <Layers size={16} />
                  <span>Карточки</span>
                </Link>
              </li>
              <li>
                <Link
                  to={`/s/${homeSemSlug}/exams`}
                  className={`sidebar-nav-item${isExamsRoute ? " active" : ""}`}
                >
                  <GraduationCap size={16} />
                  <span>Экзамены</span>
                </Link>
              </li>
              {isGroup && (
                <li>
                  <Link
                    to={`/s/${homeSemSlug}/group`}
                    className={`sidebar-nav-item${
                      isGroupRoute ? " active" : ""
                    }`}
                  >
                    <Users size={16} />
                    <span>Группа</span>
                  </Link>
                </li>
              )}
            </ul>
          </nav>

          {/* 5. Дерево курсов + ветка «Без курса» */}
          <nav className="sidebar-section sidebar-courses">
            <h3 className="sidebar-section-title">Курсы</h3>
            <ul className="sidebar-nav">
              {semesterCourses.map((c, i) => {
                const cSlug = courseSlug(c) || c.id;
                const courseUrl = `/s/${semSlugForLinks}/${cSlug}`;
                const notes = recentLectures
                  .filter((lec) => lectureCourseId(lec) === c.id)
                  .sort(
                    (a, b) =>
                      (parsePbDate(b.updated)?.getTime() ?? 0) -
                      (parsePbDate(a.updated)?.getTime() ?? 0)
                  );
                return renderBranch(
                  c.id,
                  courseName(c),
                  courseUrl,
                  courseGradient(courseColor(c), i),
                  notes,
                  (slug) => `${courseUrl}/${slug}`,
                  isLecture && course?.id === c.id,
                  c.id
                );
              })}
              {unassignedNotes.length > 0 &&
                renderBranch(
                  "",
                  "Без курса",
                  "/notes",
                  null,
                  unassignedNotes,
                  (slug) => `/note/${slug}`,
                  isNote
                )}
            </ul>
          </nav>

          {/* 6. Оглавление — только в контексте записи */}
          {(isLecture || isNote) && (
            <nav className="sidebar-section">
              <h3 className="sidebar-section-title">Оглавление</h3>
              <TableOfContents
                containerRef={tocContainerRef}
                version={tocVersion}
                hideTitle
              />
            </nav>
          )}

          <ScrollBar scrollRef={scrollRef} />
        </div>

        {/* 7. Профиль */}
        {user && (
          <div className="sidebar-profile">
            <div className="profile-avatar">
              {avatar ? (
                <img className="profile-avatar-img" src={avatar} alt="" />
              ) : (
                <span className="profile-avatar-initial">
                  {userInitial(user)}
                </span>
              )}
            </div>
            <div className="profile-info">
              <span className="profile-name" title={userName(user)}>
                {userName(user)}
              </span>
              <span className="profile-email" title={user.email}>
                {user.email}
              </span>
              {isPremiumActive(user) && (
                <span className="profile-premium">
                  Премиум до {formatDate(user.premium_until as string)}
                </span>
              )}
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
      </aside>
    </>
  );
}
