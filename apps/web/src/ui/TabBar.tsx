import { NavLink } from "react-router-dom";
import Icon, { type IconName } from "./Icon";

export interface TabBarItem {
  to: string;
  icon: IconName;
  label: string;
  /** Точное совпадение пути — иначе пункт с коротким `to` (например
   * «Главная» на `/s/:sem`) подсвечивается и на всех вложенных адресах. */
  end?: boolean;
}

interface Props {
  items: TabBarItem[];
  className?: string;
}

/** Нижняя панель телефона (.c-tabbar): 3–5 пунктов с подписями. */
export default function TabBar({ items, className }: Props) {
  return (
    <nav className={`c-tabbar${className ? ` ${className}` : ""}`} aria-label="Основная навигация">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? "on" : "")}
        >
          <Icon name={item.icon} size={22} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
