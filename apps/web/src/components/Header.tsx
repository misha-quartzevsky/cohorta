/**
 * ============================================
 *  Header.tsx
 * ============================================
 *
 * Shared top bar used on every protected page.
 * Ghosted transparent design with:
 *  - center — clickable breadcrumbs
 *  - right  — microphone
 *
 * Профиль, переключатель семестра и ПОИСК живут в GlobalSidebar
 * (DESIGN.md §7.1: один поиск на продукт, в сайдбаре).
 */

import { Link } from "react-router-dom";
import { AudioLines, Menu, Mic, MicOff, X } from "lucide-react";

import { useSpeech } from "../lib/speechContext";
import { useUiShell } from "../lib/uiShellContext";

export interface Crumb {
  label: string;
  /** Optional target route; a crumb without it renders as plain text. */
  to?: string;
}

interface Props {
  /** Navigation chain, e.g. «Рабочий стол» → course → lecture. */
  crumbs?: Crumb[];
  /**
   * When `true`, the breadcrumb labels are replaced with a thin gray
   * skeleton (the lecture title is still loading). The crumb area has
   * a fixed min-width/min-height in CSS so the header never "breathes".
   */
  crumbsLoading?: boolean;
}

function Header({ crumbs = [], crumbsLoading = false }: Props) {
  // Mobile drawer toggle (the burger button is hidden on desktop by CSS).
  const { sidebarOpen, toggleSidebar } = useUiShell();

  // Голосовой ввод: кнопка микрофона (пульс при записи) + interim-подсказка.
  // В браузерах без Web Speech API (Firefox) всё равно показываем кнопку —
  // в режиме «диктофона» (audioOnly): запись в аудиофайл без транскрибации.
  const { supported, audioOnly, recording, toggle, interimText, notice, error } =
    useSpeech();
  const canCapture = supported || audioOnly;

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {/* --- burger (mobile drawer toggle, hidden on desktop) --- */}
        <button
          type="button"
          className="header-menu-btn"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* --- breadcrumbs (center), только когда есть куда «вернуться» --- */}
        {crumbs.length > 1 && (
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            {crumbsLoading ? (
              <span
                className="skeleton-line crumb-skeleton"
                aria-hidden="true"
              />
            ) : (
              crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                const content =
                  isLast || !crumb.to ? (
                    <span className="crumb-label">{crumb.label}</span>
                  ) : (
                    <Link className="crumb-link" to={crumb.to}>
                      {crumb.label}
                    </Link>
                  );
                return (
                  <span
                    key={`${crumb.label}-${i}`}
                    className={`crumb${isLast ? " crumb-current" : ""}`}
                  >
                    {i > 0 && <span className="crumb-sep">/</span>}
                    {content}
                  </span>
                );
              })
            )}
          </nav>
        )}

        {/* --- microphone (right) --- */}
        <div className="header-right">
          {canCapture && (
            <div className="header-mic-wrap">
              <button
                type="button"
                className={`header-mic${recording ? " active" : ""}`}
                onClick={toggle}
                title={
                  recording
                    ? "Остановить запись"
                    : error
                      ? `Запись недоступна: ${error}`
                      : audioOnly
                        ? "Диктофон: аудиозапись (транскрибация не поддерживается)"
                        : "Диктовка: голосовой ввод в текст лекции"
                }
              >
                {recording ? (
                  <MicOff size={18} />
                ) : supported ? (
                  <Mic size={18} />
                ) : (
                  <>
                    <AudioLines size={18} />
                    <span className="header-mic-dictate">Диктофон</span>
                  </>
                )}
              </button>
              {recording && <span className="header-rec">● REC</span>}
              {recording && interimText && (
                <span className="header-mic-interim">{interimText}</span>
              )}
              {notice && !recording && (
                <span className="header-mic-interim">{notice}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
