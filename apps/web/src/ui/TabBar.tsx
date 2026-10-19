import { NavLink, useLocation } from "react-router-dom";
import Icon, { type IconName } from "./Icon";

export interface TabBarItem {
  to: string;
  label: string;
  icon?: IconName;
  /** Инициалы вместо иконки: кружок с аватаром («Профиль», крайний справа). */
  avatar?: string;
  /** Точное совпадение пути — иначе пункт с коротким `to` (например
   * «Главная» на `/s/:sem`) подсвечивается и на всех вложенных адресах. */
  end?: boolean;
  /** Дополнительные начала путей, на которых пункт тоже активен
   * (например «Ещё» на `/tasks` и `/decks`, куда ведёт сам экран «Ещё»). */
  alsoActive?: string[];
  /** Места, у которых ещё нет экрана: пункт виден, но не нажимается. */
  disabled?: boolean;
}

interface Props {
  items: TabBarItem[];
  className?: string;
}

/** Нижняя панель телефона (.c-tabbar): 3–5 пунктов с подписями. */
export default function TabBar({ items, className }: Props) {
  const { pathname } = useLocation();
  return (
    <nav className={`c-tabbar${className ? ` ${className}` : ""}`} aria-label="Основная навигация">
      {items.map((item) => {
        const glyph = item.avatar !== undefined ? (
          <span className="av" aria-hidden="true">{item.avatar}</span>
        ) : (
          item.icon && <Icon name={item.icon} size={22} />
        );
        if (item.disabled) {
          return (
            <a key={item.label} aria-disabled="true" role="link" tabIndex={-1} className="off">
              {glyph}
              {item.label}
            </a>
          );
        }
        const extra = item.alsoActive?.some((p) => pathname === p || pathname.startsWith(`${p}/`));
        return (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [isActive || extra ? "on" : "", item.avatar !== undefined ? "has-av" : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            {glyph}
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
