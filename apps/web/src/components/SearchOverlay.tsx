/**
 * ============================================
 *  SearchOverlay.tsx — поиск по продукту (B2, 2026-10-19)
 * ============================================
 *
 * Один компонент, два вида по CSS (styles/components.css,
 * .c-search-overlay): десктоп — оверлей над контентом рядом с
 * сайдбаром (Screen-search.dc.html), телефон — полноэкранный экран
 * со своей строкой и «Отмена» (Screen-m-search.dc.html). Состояние
 * открытия общее (lib/uiShellContext.ts) — вход и из строки в шапке,
 * и с иконки на странице «Все лекции».
 *
 * В режиме «Группа» поиск идёт только по выбранной группе: лекции одногруппников по названию, их предметы,
 * одногруппники. Открытая тебе лекция открывается на чтение, закрытая ведёт на предмет одногруппника,
 * где есть «Запросить доступ».
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useUiShell } from "../lib/uiShellContext";
import { useMode } from "../lib/modeContext";
import { useGroupCtxOptional } from "../lib/groupCtx";
import { useSemester } from "../lib/semesterContext";
import { pickActiveSemester } from "../lib/activeSemester";
import { semesterSlug, lectureHref, courseSlug } from "../lib/types";
import { pluralRu } from "../lib/format";
import { highlightMatch } from "../lib/highlightMatch";
import { useProductSearch } from "../hooks/useProductSearch";
import { isGroupSearchEmpty, isSearchEmpty } from "../services/searchService";
import { Icon, Button, EmptyState } from "../ui";
import { List, ListRow } from "../ui";
import { SubjectCover } from "../ui";

export default function SearchOverlay() {
  const { searchOpen, closeSearch } = useUiShell();
  const navigate = useNavigate();
  const { current, semesters } = useSemester();
  const activeSemester = current ?? pickActiveSemester(semesters);
  const semSlug = activeSemester ? semesterSlug(activeSemester) : "";

  const [query, setQuery] = useState("");
  const { isGroup } = useMode();
  const groupCtx = useGroupCtxOptional();
  // В режиме «Группа» ищем только в выбранной группе (Screen-search: «в режиме Группа поле то же и на том же месте»).
  const groupId = isGroup ? (groupCtx?.current?.group.id ?? "") : "";
  const groupMode = isGroup && !!groupId;
  const { result, groupResult, loading } = useProductSearch(query, searchOpen, groupId);

  useEffect(() => {
    if (!searchOpen) setQuery("");
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, closeSearch]);

  if (!searchOpen) return null;

  const q = query.trim();
  const showResults = q.length >= 2;
  const empty = showResults && !loading && (groupMode ? isGroupSearchEmpty(groupResult) : isSearchEmpty(result));

  return (
    <div className="c-search-overlay">
      <div className="c-search-backdrop" onClick={closeSearch} aria-hidden="true" />
      <div className="c-search-panel" role="dialog" aria-label="Поиск">
        <div className="c-search-field">
          <div className="c-search-box">
            <Icon name="search" size={18} />
            <input
              type="search"
              autoFocus
              placeholder="Лекции, предметы, одногруппники"
              aria-label="Поиск по продукту"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="button" className="c-search-cancel" onClick={closeSearch}>
            Отмена
          </button>
          <span className="c-search-esc">Esc</span>
        </div>

        {showResults && (
          <div className="c-search-results">
            {empty ? (
              <EmptyState
                icon="search"
                title="Ничего не нашлось"
                description="Проверь написание или поищи по другому слову. Тексты чужих лекций в поиске не участвуют."
                action={
                  <Button variant="secondary" onClick={() => setQuery("")}>
                    Очистить поиск
                  </Button>
                }
              />
            ) : groupMode ? (
              <>
                {groupResult.lectures.length > 0 && (
                  <section>
                    <h2>
                      Лекции<span className="n"> · {groupResult.lectures.length}</span>
                    </h2>
                    <List>
                      {groupResult.lectures.map((hit) => (
                        <ListRow
                          key={hit.id}
                          cover={<span className="c-search-preview-cover" aria-hidden="true" />}
                          title={highlightMatch(hit.title, q)}
                          meta={[hit.ownerName, hit.subject, hit.open ? "Открыта тебе" : "Нужен доступ"].filter(Boolean).join(" · ")}
                          onClick={() => {
                            closeSearch();
                            navigate(
                              hit.open
                                ? `/s/${semSlug}/group/lecture/${hit.lecture}`
                                : `/s/${semSlug}/group/people/${hit.ownerId}/${hit.courseKey}`
                            );
                          }}
                        />
                      ))}
                    </List>
                  </section>
                )}

                {groupResult.subjects.length > 0 && (
                  <section>
                    <h2>
                      Предметы<span className="n"> · {groupResult.subjects.length}</span>
                    </h2>
                    <List>
                      {groupResult.subjects.map((hit) => (
                        <ListRow
                          key={`${hit.ownerId}-${hit.key}`}
                          cover={<SubjectCover seed={hit.coverSeed} size={32} />}
                          title={highlightMatch(hit.title, q)}
                          meta={`${hit.ownerName} · ${hit.lectureCount} ${pluralRu(hit.lectureCount, ["лекция", "лекции", "лекций"])}`}
                          onClick={() => {
                            closeSearch();
                            navigate(`/s/${semSlug}/group/people/${hit.ownerId}/${hit.key}`);
                          }}
                        />
                      ))}
                    </List>
                  </section>
                )}

                {groupResult.people.length > 0 && (
                  <section>
                    <h2>
                      Одногруппники<span className="n"> · {groupResult.people.length}</span>
                    </h2>
                    <List>
                      {groupResult.people.map((hit) => (
                        <ListRow
                          key={hit.id}
                          cover={
                            <span className="c-search-avatar" aria-hidden="true">
                              {hit.name.slice(0, 2).toUpperCase()}
                            </span>
                          }
                          title={highlightMatch(hit.name, q)}
                          meta={groupCtx?.current?.group.name}
                          onClick={() => {
                            closeSearch();
                            navigate(`/s/${semSlug}/group/people/${hit.id}`);
                          }}
                        />
                      ))}
                    </List>
                  </section>
                )}
              </>
            ) : (
              <>
                {result.lectures.length > 0 && (
                  <section>
                    <h2>
                      Лекции<span className="n"> · {result.lectures.length}</span>
                    </h2>
                    <List>
                      {result.lectures.map((hit) => (
                        <ListRow
                          key={hit.id}
                          cover={
                            <SubjectCover
                              seed={hit.lecture.expand?.field?.cover_seed}
                              size={32}
                            />
                          }
                          title={highlightMatch(hit.title, q)}
                          meta={
                            hit.courseName
                              ? `${hit.courseName}${hit.lectureNumber ? ` · Лекция ${hit.lectureNumber}` : ""}`
                              : undefined
                          }
                          onClick={() => {
                            closeSearch();
                            navigate(lectureHref(hit.lecture, semSlug));
                          }}
                        />
                      ))}
                    </List>
                  </section>
                )}

                {result.courses.length > 0 && (
                  <section>
                    <h2>
                      Предметы<span className="n"> · {result.courses.length}</span>
                    </h2>
                    <List>
                      {result.courses.map((hit) => (
                        <ListRow
                          key={hit.id}
                          cover={<SubjectCover seed={hit.course.cover_seed} size={32} />}
                          title={highlightMatch(hit.name, q)}
                          meta={
                            hit.lectureCount !== undefined
                              ? `${hit.lectureCount} ${pluralRu(hit.lectureCount, [
                                  "лекция",
                                  "лекции",
                                  "лекций",
                                ])}`
                              : undefined
                          }
                          onClick={() => {
                            closeSearch();
                            navigate(`/s/${semSlug}/${courseSlug(hit.course)}`);
                          }}
                        />
                      ))}
                    </List>
                  </section>
                )}

                {result.previews.length > 0 && (
                  <section>
                    <h2>
                      Чужие лекции<span className="n"> · {result.previews.length}</span>
                    </h2>
                    <List>
                      {result.previews.map((hit) => (
                        <ListRow
                          key={hit.id}
                          cover={<span className="c-search-preview-cover" aria-hidden="true" />}
                          title={highlightMatch(hit.title, q)}
                          meta="Нужен доступ"
                        />
                      ))}
                    </List>
                  </section>
                )}

                {result.classmates.length > 0 && (
                  <section>
                    <h2>
                      Одногруппники<span className="n"> · {result.classmates.length}</span>
                    </h2>
                    <List>
                      {result.classmates.map((hit) => (
                        <ListRow
                          key={hit.id}
                          cover={
                            <span className="c-search-avatar" aria-hidden="true">
                              {hit.name.slice(0, 2).toUpperCase()}
                            </span>
                          }
                          title={highlightMatch(hit.name, q)}
                          meta={hit.groupName}
                        />
                      ))}
                    </List>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        <div className="c-search-footnote">
          Чужие лекции в поиске видны только по названию, текст не ищется.
        </div>
      </div>
    </div>
  );
}
