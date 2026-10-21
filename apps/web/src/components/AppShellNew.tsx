/**
 * ============================================
 *  AppShellNew.tsx — новый каркас (A4, 2026-10-18)
 * ============================================
 *
 * Левое меню 264px, контент до 1120px по центру, телефон — TabBar.
 * Переключатель Соло/Группа — в сайдбаре под логотипом (так на обоих
 * мокапах, Screen-dashboard.dc.html и Screen-editor.dc.html — в шапке
 * только поиск). Строка в шапке открывает поиск по продукту
 * (components/SearchOverlay.tsx, B2) — сам ввод живёт в оверлее, не
 * в самой шапке.
 *
 * За флагом VITE_NEW_UI (lib/featureFlags.ts): пока волны A/B1 не
 * закрыты, старый каркас (AppLayout → GlobalSidebar/Header) остаётся
 * дефолтным. Этот компонент не трогает их код.
 */

import type { MouseEvent as ReactMouseEvent } from "react";
import FormsProvider from "./forms/FormsProvider";
import { useForms } from "../lib/formsContext";
import { useLectureActions } from "./lectures/useLectureActions";
import type { Lecture } from "../lib/types";
import DraftCover from "./lectures/DraftCover";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";

import { useUiShell } from "../lib/uiShellContext";
import SearchOverlay from "./SearchOverlay";
import { useMode, type Mode } from "../lib/modeContext";
import { useSemester } from "../lib/semesterContext";
import { lastSemesterSlug } from "../lib/lastSemester";
import { pickActiveSemester } from "../lib/activeSemester";
import { semesterSlug, courseName, courseSlug as courseSlugOf, courseSemesterId, lectureCourseId, lectureSlug, lectureTitle } from "../lib/types";
import { useLectureFrame } from "../lib/lectureFrame";
import { useLectures } from "../hooks/useLectures";
import { useLectureBySlug } from "../hooks/useLectureBySlug";
import { useRecentLectures } from "../hooks/useRecentLectures";
import { useCourses } from "../hooks/useCourses";
import { useAuth } from "../hooks/useAuth";
import { useTocScan } from "../hooks/useTocScan";
import { userName, nameInitials } from "../lib/format";
import { Icon, Menu, Segmented, TabBar, LectureToc, SubjectCover } from "../ui";
import type { IconName, TocItem, TabBarItem } from "../ui";
import {
  UnderstandingScope,
  UnderstandingAside,
  useOpenUnderstandingSheet,
} from "./quiz/UnderstandingScope";

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
  const { courses, loading: coursesLoading } = useCourses(activeSemester?.id ?? "");
  const { lectures } = useRecentLectures(100);

  const countByCourse = new Map<string, number>();
  let draftsCount = 0;
  for (const lec of lectures) {
    const cid = lectureCourseId(lec);
    if (!cid) {
      draftsCount += 1;
      continue;
    }
    countByCourse.set(cid, (countByCourse.get(cid) ?? 0) + 1);
  }

  return { courses, coursesLoading, countByCourse, draftsCount, totalLectures: lectures.length };
}

function useSoloNavItems(): NavItem[] {
  const semSlug = useSemSlug();
  const { totalLectures } = useCourseList();
  return [
    { to: `/s/${semSlug}`, icon: "home", label: "Главная", end: true },
    { to: "/tasks", icon: "task", label: "Задачи" },
    { to: "/schedule", icon: "cal", label: "Расписание" },
    {
      to: `/s/${semSlug}/lectures`,
      icon: "doc",
      label: "Все лекции",
      // Счётчик «0» не показываем (пустой аккаунт, States-empty).
      count: totalLectures > 0 ? totalLectures : undefined,
    },
    { to: "/decks", icon: "cards", label: "Карточки" },
  ];
}

/**
 * Нижняя панель телефона (Screen-m-profile-draft, CHANGES-2026-10-19).
 * Соло: Главная, Расписание, Лекции, Ещё, Профиль (кружок с аватаром).
 * Группа: Люди, Доступ, Экзамены, Профиль. «Задачи» и «Карточки» живут
 * на экране «Ещё» (pages/MorePage.tsx), а не в панели.
 */
function MobileTabBar() {
  const semSlug = useSemSlug();
  const { isGroup } = useMode();
  const { user } = useAuth();
  const profile: TabBarItem = {
    to: "/profile",
    label: "Профиль",
    avatar: user ? nameInitials(userName(user)) : "",
  };
  const items: TabBarItem[] = isGroup
    ? [
        { to: `/s/${semSlug}/group`, icon: "people", label: "Люди" },
        // Экрана «Мой доступ» ещё нет (волна C, g_myaccess) — пункт виден, но не нажимается.
        { to: "/", icon: "lock", label: "Доступ", disabled: true },
        { to: `/s/${semSlug}/exams`, icon: "exam", label: "Экзамены" },
        profile,
      ]
    : [
        { to: `/s/${semSlug}`, icon: "home", label: "Главная", end: true },
        { to: "/schedule", icon: "cal", label: "Расписание" },
        // «Предметы» на телефоне отдельной вкладки не имеют — открываются
        // из «Лекции» (раздел 4 инструкции, A4; экран — B2, LecturesAllPage).
        {
          to: `/s/${semSlug}/lectures`,
          icon: "doc",
          label: "Лекции",
          // Страница предмета, его лекции, пары и экзамен — тоже раздел «Лекции».
          activeWhen: /^\/s\/[^/]+\/(?!courses$|exams$|group$)[^/]+(\/.*)?$/,
        },
        { to: "/more", icon: "grid", label: "Занятия", alsoActive: ["/tasks", "/decks"] },
        profile,
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

  // Список прокручивается сам; внизу тень, пока есть что листать; текущий пункт сам доезжает до видимой зоны.
  const listRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const updateMore = useCallback(() => {
    const el = listRef.current;
    setMore(!!el && el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);
  useEffect(() => {
    updateMore();
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(updateMore);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length, updateMore]);
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>("a.on");
    if (!list || !active) return;
    const top = active.offsetTop;
    const bottom = top + active.offsetHeight;
    if (top < list.scrollTop) list.scrollTo({ top: top - 8, behavior: "smooth" });
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTo({ top: bottom - list.clientHeight + 8, behavior: "smooth" });
  }, [activeId]);

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
      {!courseSlug && (
        <button
          type="button"
          className="c-shell-back"
          onClick={() => {
            onNavigate();
            navigate(`/s/${semSlug}/drafts`);
          }}
        >
          <Icon name="chev" size={16} style={{ transform: "rotate(180deg)" }} />
          <DraftCover size={18} />
          Черновики
        </button>
      )}
      <div className="c-shell-section">
        <span>Содержание</span>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="c-shell-toc-empty">
          Добавь заголовок, и он появится здесь.
          <span className="c-shell-toc-more"> Так удобно прыгать по длинной лекции.</span>
        </p>
      ) : (
        <div className={`c-shell-toc-wrap${more ? " more" : ""}`}>
          <div className="c-shell-toc" ref={listRef} onScroll={updateMore}>
            <LectureToc
              items={items}
              activeId={activeId}
              onSelect={(id) => {
                scrollTo(scanned[Number(id)]);
                onNavigate();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

/** Раздел «Предметы» (Screen-dashboard.dc.html): плоский список курсов
 * семестра с обложкой и числом лекций, «+» ведёт на страницу курсов —
 * создание прямо из сайдбара пока не делаю (форма живёт на странице). */
function SidebarCourses({ semSlug, onNavigate }: { semSlug: string; onNavigate: () => void }) {
  const { courses, coursesLoading, countByCourse, draftsCount } = useCourseList();
  const addHref = `/s/${semSlug}/courses`;
  const forms = useForms();
  // Форма «Новый предмет» — окно поверх страницы (B3); без каркаса форм — прежняя страница.
  const addSubject = (e: ReactMouseEvent) => {
    if (!forms) return;
    e.preventDefault();
    onNavigate();
    forms.openSubjectForm();
  };
  return (
    <>
      <div className="c-shell-section">
        <span>Предметы</span>
        <NavLink to={addHref} onClick={addSubject} aria-label="Добавить предмет">
          <Icon name="plus" size={16} />
        </NavLink>
      </div>
      <nav className="c-shell-courses" aria-label="Предметы семестра">
        {/* Пустой аккаунт: вместо пустого поля — строка с тем же действием, что у «+». */}
        {/* «Черновики» — предмет по умолчанию, всегда первый; появляется, когда есть лекция без предмета. */}
        {draftsCount > 0 && (
          <NavLink
            to={`/s/${semSlug}/drafts`}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? "on" : "")}
          >
            <DraftCover size={22} />
            <span className="name">Черновики</span>
            <span className="count">{draftsCount}</span>
          </NavLink>
        )}
        {courses.length === 0 && !coursesLoading && (
          <NavLink to={addHref} onClick={addSubject} className="c-shell-courses-empty">
            Добавь первый предмет
          </NavLink>
        )}
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
function SidebarProfile() {
  const { user } = useAuth();
  if (!user) return null;
  const name = userName(user);
  const initial = nameInitials(name);
  return (
    <Link to="/settings" className="c-shell-profile" aria-label="Профиль и настройки">
      <span className="avatar">{initial}</span>
      <span className="tx">
        <span className="name">{name}</span>
        <span className="sub">Профиль</span>
      </span>
      <Icon name="chev" size={18} />
    </Link>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useSoloNavItems();
  const semSlug = useSemSlug();
  const { courseSlug, lectureSlug } = useParams();
  const inLecture = !!lectureSlug;
  const { mode, setMode } = useMode();
  const { openSearch } = useUiShell();

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
          src="/brand/cohorta-logo-mono-ink.svg"
          alt="cohorta"
        />
        {/* Глобальный поиск (20.10): поле под логотипом, ⌘K / Ctrl+K открывает его с любого места. */}
        <button type="button" className="c-shell-side-search" onClick={() => { onClose(); openSearch(); }}>
          <Icon name="search" size={18} />
          <span className="lbl">Поиск</span>
          <kbd>⌘K</kbd>
        </button>
        {/* Переключатель живёт в сайдбаре под логотипом на обоих мокапах
            (Screen-dashboard.dc.html, Screen-editor.dc.html), не в шапке. */}
        <Segmented
          className="c-shell-mode"
          aria-label="Режим"
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
        />
        {/* Основная навигация остаётся всегда — на странице лекции меняется
            только раздел «Предметы» ниже (Screen-editor.png: Главная/Задачи/
            Расписание/Все лекции/Карточки видны и там тоже). Раньше весь
            сайдбар подменялся оглавлением — расхождение с макетом. */}
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
        {inLecture ? (
          <SidebarLectureToc courseSlug={courseSlug} onNavigate={onClose} />
        ) : (
          <SidebarCourses semSlug={semSlug} onNavigate={onClose} />
        )}
        {!inLecture && <div className="c-shell-spacer" />}
        <SidebarProfile />
      </aside>
    </>
  );
}

/**
 * Верхняя полоса открытой лекции. Компьютер (Screen-editor): слева крошки «Предмет › Лекция N»
 * («Черновики › Лекция N» без предмета), справа «● Сохранено» и «···» с меню лекции.
 * Телефон: содержание, «···» (лист меню, Screen-m-lecture-menu) и «Понимание». Строки поиска нет:
 * поиск глобальный (сайдбар на компьютере, лупа на корневых экранах телефона).
 */
function Topbar({ open, onBurger, lecture }: { open: boolean; onBurger: () => void; lecture: Lecture | null }) {
  const navigate = useNavigate();
  const { courseSlug } = useParams();
  const semSlug = useSemSlug();
  const { semesters } = useSemester();
  const { saveIndicator, requestTags, flushNow } = useLectureFrame();
  const openUnderstanding = useOpenUnderstandingSheet();
  const actions = useLectureActions({
    onRename: () => document.querySelector<HTMLInputElement>(".lecture-title-input")?.focus(),
    onDeleted: () => navigate(courseSlug ? `/s/${semSlug}/${courseSlug}` : `/s/${semSlug}/lectures`),
    extraItems: (lec) => [
      { label: "Теги", icon: <Icon name="grid" size={18} />, onClick: requestTags },
      { label: "Квиз по лекции", icon: <Icon name="task" size={18} />, onClick: () => navigate(`/quiz/${lec.id}`) },
    ],
    // Назначили предмет черновику — лекция уходит из «Черновиков», открываем её по новому адресу.
    sheetExtraItems: () =>
      openUnderstanding ? [{ label: "Понимание темы", icon: <Icon name="bulb" size={18} />, onClick: openUnderstanding }] : [],
    onMoved: (lec, course) => {
      const sem = semesters.find((x) => x.id === courseSemesterId(course));
      navigate(`/s/${sem ? semesterSlug(sem) : semSlug}/${courseSlugOf(course)}/${lectureSlug(lec)}`, { replace: true });
    },
  });
  const course = lecture && lectureCourseId(lecture) ? lecture.expand?.field : undefined;
  const lectureLabel = lecture ? (lecture.number ? `Лекция ${lecture.number}` : lectureTitle(lecture)) : "";
  return (
    <header className="c-shell-topbar">
      {/* Телефон (Screen-m-editor): «‹ Предмет» слева, «Сохранено» по центру, «≡» (только содержание) и «···» справа. */}
      <Link className="c-shell-back-m" to={course ? `/s/${semSlug}/${courseSlugOf(course)}` : `/s/${semSlug}/drafts`}>
        <Icon name="chev" size={18} style={{ transform: "rotate(180deg)" }} />
        {course || !lecture ? "Предмет" : "Черновики"}
      </Link>
      {saveIndicator && (
        <button
          type="button"
          className={`c-shell-save-m ${saveIndicator.state}`}
          disabled={saveIndicator.state !== "error"}
          onClick={() => void flushNow()}
          aria-live="polite"
        >
          {saveIndicator.state === "saving"
            ? "Сохраняю…"
            : saveIndicator.state === "error"
              ? "Не сохранено"
              : saveIndicator.state === "queued"
                ? "Сохранено на устройстве"
                : "Сохранено"}
        </button>
      )}
      <button
        type="button"
        className="c-shell-burger"
        onClick={onBurger}
        aria-label={open ? "Закрыть содержание" : "Открыть содержание"}
        aria-expanded={open}
      >
        <Icon name={open ? "x" : "toc"} size={20} />
      </button>
      {lecture && (
        <nav className="c-shell-crumbs" aria-label="Путь">
          {course ? (
            <Link to={`/s/${semSlug}/${courseSlugOf(course)}`}>{courseName(course)}</Link>
          ) : (
            <Link to={`/s/${semSlug}/drafts`}>Черновики</Link>
          )}
          <Icon name="chev" size={14} />
          <span className="cur">{lectureLabel}</span>
        </nav>
      )}
      <span className="c-shell-topbar-gap" />
      {saveIndicator && (
        <span className={`c-shell-save ${saveIndicator.state}`} role="status">
          <i aria-hidden="true" />
          {saveIndicator.text}
        </span>
      )}
      {lecture && (
        <>
          <button type="button" className="c-shell-more c-shell-more-m" aria-label="Меню лекции" onClick={() => actions.openSheet(lecture)}>
            <Icon name="dots" size={20} />
          </button>
          <span className="c-shell-more-d">
            <Menu
              width={280}
              aria-label={`Меню лекции «${lectureTitle(lecture)}»`}
              trigger={(p) => (
                <button
                  type="button"
                  className="c-shell-more"
                  aria-label="Меню лекции"
                  onClick={p.onClick}
                  ref={p.ref}
                  aria-expanded={p["aria-expanded"]}
                  aria-haspopup={p["aria-haspopup"]}
                >
                  <Icon name="dots" size={20} />
                </button>
              )}
              items={actions.itemsFor(lecture)}
            />
          </span>
        </>
      )}
      {actions.dialogs}
    </header>
  );
}

export default function AppShellNew() {
  const { sidebarOpen, toggleSidebar, closeSidebar, openSearch } = useUiShell();

  // ⌘K / Ctrl+K открывает поиск с любого экрана.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch]);
  const { lectureSlug } = useParams();
  const inLecture = !!lectureSlug;
  const { lecture } = useLectureBySlug(lectureSlug ?? "");

  return (
    <FormsProvider>
    <div className="c-shell">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      {/* Один набор данных «Твоё понимание темы» на колонку справа (компьютер)
          и шторку (телефон); вне страницы лекции scope пустой. */}
      <UnderstandingScope lecture={inLecture ? lecture : null}>
        <div className="c-shell-main">
          {inLecture && <Topbar open={sidebarOpen} onBurger={toggleSidebar} lecture={lecture} />}
          {/* Контент: поля 40px на десктопе, до 1120px по центру. */}
          <div className={`c-shell-content${inLecture ? " with-aside" : ""}`}>
            <Outlet />
            {inLecture && <UnderstandingAside />}
          </div>
          <SearchOverlay />
        </div>
      </UnderstandingScope>
      {!inLecture && <MobileTabBar />}
    </div>
    </FormsProvider>
  );
}
