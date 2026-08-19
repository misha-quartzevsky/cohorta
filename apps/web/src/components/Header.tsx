/**
 * ============================================
 *  Header.tsx
 * ============================================
 *
 * Shared top bar used on every protected page.
 * Ghosted transparent design with:
 *  - center — clickable breadcrumbs
 *  - right  — microphone + search
 *
 * Profile and semester switcher moved to GlobalSidebar.
 */

import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mic, MicOff, Search } from "lucide-react";

import { useLectureSearch } from "../hooks/useLectureSearch";
import { useSpeech } from "../lib/speechContext";
import ScrollBar from "./scrollbar/ScrollBar";

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
  const navigate = useNavigate();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const { results, loading } = useLectureSearch(query, open);

  // Голосовой ввод: кнопка микрофона (пульс при записи) + interim-подсказка.
  const { supported, recording, toggle, interimText, error } = useSpeech();

  /** Прыжок к найденной лекции + закрытие дропдауна. */
  const go = (to: string) => {
    setOpen(false);
    setQuery("");
    setIsSearchFocused(false);
    navigate(to);
  };

  const close = () => {
    setOpen(false);
    setIsSearchFocused(false);
  };

  const showDropdown = open && query.trim().length >= 2;

  return (
    <header className={`app-header${isSearchFocused ? " search-focused" : ""}`}>
      <div className="app-header-inner">
        {/* --- breadcrumbs (center), только когда есть куда «вернуться» --- */}
        {crumbs.length > 1 && (
          <nav
            className={`breadcrumbs${isSearchFocused ? " faded" : ""}`}
            aria-label="Хлебные крошки"
          >
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

        {/* --- microphone + search (right) --- */}
        <div className="header-right">
          {supported && (
            <div className="header-mic-wrap">
              <button
                type="button"
                className={`header-mic${recording ? " active" : ""}`}
                onClick={toggle}
                title={
                  recording
                    ? "Остановить диктовку"
                    : error
                      ? `Диктовка недоступна: ${error}`
                      : "Диктовка: голосовой ввод в текст лекции"
                }
              >
                {recording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              {recording && interimText && (
                <span className="header-mic-interim">{interimText}</span>
              )}
            </div>
          )}
          <div
            ref={searchWrapRef}
            className="search-wrap"
            onBlur={(e) => {
              if (
                searchWrapRef.current &&
                !searchWrapRef.current.contains(e.relatedTarget as Node)
              ) {
                close();
              }
            }}
          >
            <label className={`search-box${isSearchFocused ? " focused" : ""}`}>
              <Search size={16} className="search-icon" />
              <input
                className="search-input"
                type="text"
                placeholder="Найти заметку"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!open) setOpen(true);
                }}
                onFocus={() => {
                  setIsSearchFocused(true);
                  setOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.currentTarget.blur();
                    setQuery("");
                    close();
                  }
                }}
              />
            </label>

            {showDropdown && (
              <div ref={dropdownRef} className="search-dropdown">
                {loading && <div className="search-status">Ищем…</div>}
                {!loading && results.length === 0 && (
                  <div className="search-status">Ничего не найдено</div>
                )}
                {results.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="search-dropdown-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(hit.to)}
                  >
                    <span className="search-item-title">{hit.title}</span>
                    {hit.snippet && (
                      <span className="search-item-snippet">
                        {hit.snippet}
                      </span>
                    )}
                    {hit.courseName && (
                      <span className="search-item-course">
                        {hit.courseName}
                      </span>
                    )}
                  </button>
                ))}
                <ScrollBar scrollRef={dropdownRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
