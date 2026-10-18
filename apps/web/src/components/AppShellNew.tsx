/**
 * ============================================
 *  AppShellNew.tsx — новый каркас (A4, 2026-10-18)
 * ============================================
 *
 * Левое меню 264px, контент до 1120px по центру, телефон — TabBar.
 * Переключатель Соло/Группа — в сайдбаре под логотипом (так на обоих
 * мокапах, Screen-dashboard.dc.html и Screen-editor.dc.html — в шапке
 * только поиск, пока только вид, раздел 4 инструкции, A4; сам поиск
 * продукта это волна B2).
 *
 * За флагом VITE_NEW_UI (lib/featureFlags.ts): пока волны A/B1 не
 * закрыты, старый каркас (AppLayout → GlobalSidebar/Header) остаётся
 * дефолтным. Этот компонент не трогает их код.
 */

import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";

import { useUiShell } from "../lib/uiShellContext";
import { useMode, type Mode } from "../lib/modeContext";
import { useSemester } from "../lib/semesterContext";
import { lastSemesterSlug } from "../lib/lastSemester";
import { pickActiveSemester } from "../lib/activeSemester";
import { semesterSlug, courseName, courseSlug as courseSlugOf, lectureCourseId } from "../lib/types";
import { useLectureFrame } from "../lib/lectureFrame";
import { useLectures } from "../hooks/useLectures";
import { useLectureBySlug } from "../hooks/useLectureBySlug";
import { useRecentLectures } from "../hooks/useRecentLectures";
import { useCourses } from "../hooks/useCourses";
import { useAuth } from "../hooks/useAuth";
import { useTocScan } from "../hooks/useTocScan";
import { userName } from "../lib/format";
import { Icon, Segmented, TabBar, LectureToc, SubjectCover } from "../ui";
import type { IconName, TocItem } from "../ui";
import LectureReadinessAside from "./LectureReadinessAside";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "solo", label: "Соло" },
  { value: "group", label: "Группа" },
];

interface NavItem {
  to: string;
  icon: IconName;
  label: string;
  /** Точное совпадение пути (см. ui/TabBar.tsx) — нужно «Главной»,
   * иначе react-router подсвечивает её и на /s/:sem/courses и т. д. */
  end?: boolean;
  count?: number;
}

function useSemSlug(): string {
  const { current } = useSemester();
  return current ? semesterSlug(current) : lastSemesterSlug() || "1";
}

/** Курсы семестра + число лекций каждого — для раздела «Предметы»
 * и счётчика «Все лекции» (Screen-dashboard.dc.html). Тот же источник,
 * что у старого сайдбара (components/GlobalSidebar.tsx: useRecentLectures(100)). */
function useCourseList() {
  const { current, semesters } = useSemester();
  const activeSemester = current ?? pickActiveSemester(semesters);
  const { courses } = useCourses(activeSemester?.id ?? "");
  const { lectures } = useRecentLectures(100);

  const countByCourse = new Map<string, number>();
  for (const lec of lectures) {
    const cid = lectureCourseId(lec);
    if (!cid) continue;
    countByCourse.set(cid, (countByCourse.get(cid) ?? 0) + 1);
  }

  return { courses, countByCourse, totalLectures: lectures.length };
}

function useSoloNavItems(): NavItem[] {
  const semSlug = useSemSlug();
  const { totalLectures } = useCourseList();
  return [
    { to: `/s/${semSlug}`, icon: "home", label: "Главная", end: true },
    { to: "/tasks", icon: "task", label: "Задачи" },
    { to: "/schedule", icon: "cal", label: "Расписание" },
    // TODO (B2): своя страница «Все лекции» — пока алиас на /courses (App.tsx),
    // но свой адрес, чтобы не подсвечиваться вместе с «Предметы».
    { to: `/s/${semSlug}/lectures`, icon: "doc", label: "Все лекции", count: totalLectures },
    { to: "/decks", icon: "cards", label: "Карточки" },
  ];
}

function MobileTabBar() {
  const semSlug = useSemSlug();
  const items = [
    { to: `/s/${semSlug}`, icon: "home" as const, label: "Главная", end: true },
    { to: "/tasks", icon: "task" as const, label: "Задачи" },
    { to: "/schedule", icon: "cal" as const, label: "Расписание" },
    // «Предметы» на телефоне отдельной вкладки не имеет — открываются
    // из «Лекции» (раздел 4 инструкции, A4).
    { to: `/s/${semSlug}/courses`, icon: "doc" as const, label: "Лекции" },
    { to: "/decks", icon: "cards" as const, label: "Карточки" },
  ];
  return <TabBar items={items} />;
}

/**
 * Левая колонка на странице лекции: содержание вместо списка предметов
 * (раздел B1 инструкции), ссылка назад к предмету над ним. Данные те же,
 * что у старого TableOfContents.tsx (components/TableOfContents.tsx) —
 * общий хук useTocScan, только новая вёрстка (ui/LectureToc).
 */
function SidebarLectureToc({ courseSlug, onNavigate }: { courseSlug?: string; onNavigate: () => void }) {
  const semSlug = useSemSlug();
  const navigate = useNavigate();
  const { tocContainerRef, tocVersion } = useLectureFrame();
  const { course } = useLectures(courseSlug ?? "", !!courseSlug);
  const { items: scanned, activeIndex, scrollTo } = useTocScan(tocContainerRef, tocVersion);

  const items: TocItem[] = scanned.map((it, i) => ({
    id: String(i),
    text: it.text,
    level: (it.level >= 3 ? 3 : it.level === 2 ? 2 : 1) as 1 | 2 | 3,
  }));
  const activeId = activeIndex >= 0 ? String(activeIndex) : undefined;

  return (
    <>
      {courseSlug && (
        <button
          type="button"
          className="c-shell-back"
          onClick={() => {
            onNavigate();
            navigate(`/s/${semSlug}/${courseSlug}`);
          }}
        >
          <Icon name="chev" size={16} style={{ transform: "rotate(180deg)" }} />
          {course && <SubjectCover seed={course.cover_seed} size={18} />}
          {course ? courseName(course) : "Предмет"}
        </button>
      )}
      <div className="c-shell-section">
        <span>Содержание</span>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="c-shell-toc-empty">
          Добавь заголовок, и он появится здесь. Так удобно прыгать по
          длинной лекции.
        </p>
      ) : (
        <LectureToc
          items={items}
          activeId={activeId}
          onSelect={(id) => {
            scrollTo(scanned[Number(id)]);
            onNavigate();
          }}
        />
      )}
    </>
  );
}

/** Раздел «Предметы» (Screen-dashboard.dc.html): плоский список курсов
 * семестра с обложкой и числом лекций, «+» ведёт на страницу курсов —
 * создание прямо из сайдбара пока не делаю (форма живёт на странице). */
function SidebarCourses({ semSlug, onNavigate }: { semSlug: string; onNavigate: () => void }) {
  const { courses, countByCourse } = useCourseList();
  return (
    <>
      <div className="c-shell-section">
        <span>Предметы</span>
        <NavLink to={`/s/${semSlug}/courses`} onClick={onNavigate} aria-label="Добавить предмет">
          <Icon name="plus" size={16} />
        </NavLink>
      </div>
      <nav className="c-shell-courses" aria-label="Предметы семестра">
        {courses.map((c) => (
          <NavLink
            key={c.id}
            to={`/s/${semSlug}/${courseSlugOf(c)}`}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? "on" : "")}
          >
            <SubjectCover seed={c.cover_seed} size={22} />
            <span className="name">{courseName(c)}</span>
            <span className="count">{countByCourse.get(c.id) ?? 0}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}

/** Профиль внизу сайдбара (Screen-dashboard.dc.html). Ведёт в настройки —
 * страницы ещё нет (волна B6), поэтому пока не кликабелен. */
/** «АК» из «Анастасия К.» — инициалы первых двух слов имени, если
 * второе есть; иначе одна буква (Screen-dashboard.dc.html). */
function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

function SidebarProfile() {
  const { user } = useAuth();
  if (!user) return null;
  const name = userName(user);
  const initial = profileInitials(name);
  return (
    <div className="c-shell-profile">
      <span className="avatar">{initial}</span>
      <span className="tx">
        <span className="name">{name}</span>
        <span className="sub">Профиль</span>
      </span>
      <Icon name="chev" size={18} />
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useSoloNavItems();
  const semSlug = useSemSlug();
  const { courseSlug, lectureSlug } = useParams();
  const inLecture = !!lectureSlug;
  const { mode, setMode } = useMode();

  return (
    <>
      {open && (
        <div
          className="c-shell-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`c-shell-sidebar${open ? " open" : ""}${inLecture ? " sheet" : ""}`}>
        <img
          className="c-shell-logo"
          src="/brand/cohorta-logo-primary.svg"
          alt="cohorta"
        />
        {/* Переключатель живёт в сайдбаре под логотипом на обоих мокапах
            (Screen-dashboard.dc.html, Screen-editor.dc.html), не в шапке. */}
        <Segmented
          className="c-shell-mode"
          aria-label="Режим"
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
        />
        {inLecture ? (
          <SidebarLectureToc courseSlug={courseSlug} onNavigate={onClose} />
        ) : (
          <>
            <nav className="c-shell-nav" aria-label="Основная навигация">
              {items.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) => (isActive ? "on" : "")}
                >
                  <Icon name={item.icon} size={20} />
                  <span className="label">{item.label}</span>
                  {item.count !== undefined && <span className="count">{item.count}</span>}
                </NavLink>
              ))}
            </nav>
            <SidebarCourses semSlug={semSlug} onNavigate={onClose} />
            <div className="c-shell-spacer" />
            <SidebarProfile />
          </>
        )}
      </aside>
    </>
  );
}

function Topbar({ open, onBurger }: { open: boolean; onBurger: () => void }) {
  const { lectureSlug } = useParams();
  const inLecture = !!lectureSlug;
  const label = inLecture
    ? open
      ? "Закрыть содержание"
      : "Открыть содержание"
    : open
      ? "Закрыть меню"
      : "Открыть меню";
  return (
    <header className="c-shell-topbar">
      <button
        type="button"
        className="c-shell-burger"
        onClick={onBurger}
        aria-label={label}
        aria-expanded={open}
      >
        {/* icons.md не даёт отдельной "гамбургер"-иконки — ближайшая по
            смыслу из набора (три линии убывающей длины), до появления
            своей в дизайн-системе. На странице лекции кнопка открывает
            содержание нижней панелью (раздел B1 инструкции). */}
        <Icon name={open ? "x" : "toc"} size={20} />
      </button>
      <div className="c-shell-search">
        <Icon name="search" size={16} />
        <input type="search" placeholder="Поиск" aria-label="Поиск" disabled />
      </div>
    </header>
  );
}

/** Готовность лекции (правая колонка) — только на странице лекции. */
function LectureAsideSlot() {
  const { lectureSlug } = useParams();
  const { lecture } = useLectureBySlug(lectureSlug ?? "");
  if (!lecture) return null;
  return <LectureReadinessAside lectureId={lecture.id} />;
}

export default function AppShellNew() {
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUiShell();
  const { lectureSlug } = useParams();
  const inLecture = !!lectureSlug;

  return (
    <div className="c-shell">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="c-shell-main">
        <Topbar open={sidebarOpen} onBurger={toggleSidebar} />
        {/* Контент: поля 40px на десктопе, до 1120px по центру. */}
        <div className={`c-shell-content${inLecture ? " with-aside" : ""}`}>
          <Outlet />
          {inLecture && <LectureAsideSlot />}
        </div>
      </div>
      <MobileTabBar />
    </div>
  );
}
