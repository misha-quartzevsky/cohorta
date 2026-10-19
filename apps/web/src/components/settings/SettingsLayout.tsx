import type { ReactNode } from "react";

import { SETTINGS_SECTIONS } from "./sections";

/** Каркас «Профиль и настройки»: заголовок, оглавление слева, содержимое справа. */
export default function SettingsLayout({
  active,
  onPick,
  children,
}: {
  active: string;
  onPick: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="c-settings">
      <h1>Профиль и настройки</h1>
      <div className="c-settings-cols">
        <nav className="c-settings-toc" aria-label="Разделы настроек">
          {SETTINGS_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={active === s.id ? "on" : ""}
              aria-current={active === s.id ? "true" : undefined}
              onClick={() => onPick(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="c-settings-main">{children}</div>
      </div>
    </div>
  );
}

