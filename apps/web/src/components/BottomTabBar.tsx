import { Link, useLocation } from "react-router-dom";
import { Home, CheckSquare, CalendarDays, FileText, Layers } from "lucide-react";
import { useSemester } from "../lib/semesterContext";
import { semesterSlug } from "../lib/types";
import { lastSemesterSlug } from "../lib/lastSemester";

/**
 * Нижняя панель вкладок для телефона (spec 1A.8, < 768 px).
 * Главная · Задачи · Расписание · Лекции · Карточки.
 * На планшете и десктопе скрыта (CSS). Учитывает safe-area-inset.
 */
export default function BottomTabBar() {
  const location = useLocation();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : lastSemesterSlug() || "1";

  const path = location.pathname;
  const tabs = [
    {
      to: `/s/${semSlug}`,
      label: "Главная",
      icon: Home,
      active: /^\/s\/[^/]+$/.test(path),
    },
    { to: "/tasks", label: "Задачи", icon: CheckSquare, active: path === "/tasks" },
    {
      to: "/schedule",
      label: "Расписание",
      icon: CalendarDays,
      active: path === "/schedule",
    },
    { to: "/notes", label: "Лекции", icon: FileText, active: path === "/notes" },
    {
      to: "/decks",
      label: "Карточки",
      icon: Layers,
      active: path.startsWith("/decks"),
    },
  ];

  return (
    <nav className="ds-bottombar ds-root" aria-label="Основная навигация">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`ds-bottombar__tab${t.active ? " ds-bottombar__tab--active" : ""}`}
            aria-current={t.active ? "page" : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
