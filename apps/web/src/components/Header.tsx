/**
 * ============================================
 *  Header.tsx
 * ============================================
 *
 * Shared top bar used on every protected page.
 * Three sections:
 *  - left   — current user (avatar, name, email) + logout
 *  - center — clickable breadcrumbs
 *  - right  — semester switcher + «Найти заметку» search
 *
 * Focusing the search input (`isSearchFocused`) expands it
 * slightly and fades the breadcrumbs for a soft focus shift.
 */

import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Mic, MicOff, Search } from "lucide-react";

import SemesterSwitcher from "./SemesterSwitcher";
import { useAuth } from "../hooks/useAuth";
import { useLectureSearch } from "../hooks/useLectureSearch";
import { useSpeech } from "../lib/speechContext";
import { pb } from "../lib/pocketbase";
import type { User } from "../lib/types";

export interface Crumb {
  label: string;
  /** Optional target route; a crumb without it renders as plain text. */
  to?: string;
}

interface Props {
  /** Navigation chain, e.g. «Рабочий стол» → course → lecture. */
  crumbs?: Crumb[];
}

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

function Header({ crumbs = [] }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const { results, loading } = useLectureSearch(query, open);

  // Голосовой ввод: кнопка микрофона (пульс при записи) + interim-подсказка.
  const { supported, recording, toggle, interimText, error } = useSpeech();

  const avatar = user ? avatarSrc(user) : "";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

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
        {/* --- user profile (left) --- */}
        <div className="header-profile">
          <div className="avatar">
            {avatar ? (
              <img className="avatar-img" src={avatar} alt="" />
            ) : (
              <span className="avatar-fallback">
                {user ? userInitial(user) : "C"}
              </span>
            )}
          </div>

          {user && (
            <div className="profile-text">
              <span className="profile-name">{userName(user)}</span>
              {user.email && (
                <span className="profile-email">{user.email}</span>
              )}
            </div>
          )}

          <button
            className="logout-btn"
            type="button"
            onClick={handleLogout}
            title="Выйти"
            aria-label="Выйти"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* --- breadcrumbs (center), только когда есть куда «вернуться» --- */}
        {crumbs.length > 1 && (
          <nav className={`breadcrumbs${isSearchFocused ? " faded" : ""}`}>
            {crumbs.map((crumb, i) => {
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
            })}
          </nav>
        )}

        {/* --- semester switcher + search (right) --- */}
        <div className="header-right">
          {supported && (
            <div className="header-mic-wrap">
              <button
                type="button"
                className={`header-mic${recording ? " recording" : ""}`}
                onClick={toggle}
                title={
                  recording
                    ? "Остановить диктовку"
                    : error
                      ? `Диктовка недоступна: ${error}`
                      : "Диктовка: голосовой ввод в текст лекции"
                }
              >
                {recording ? <MicOff size={15} /> : <Mic size={15} />}
                {recording && <span className="header-mic-pulse" />}
              </button>
              {recording && interimText && (
                <span className="header-mic-interim">{interimText}</span>
              )}
            </div>
          )}
          <SemesterSwitcher />
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
              <div className="search-dropdown">
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
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
