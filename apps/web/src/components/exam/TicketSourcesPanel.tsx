import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button, Icon, SubjectCover } from "../../ui";
import type { Course, Lecture } from "../../lib/types";
import { courseName, lectureTitle } from "../../lib/types";

interface Props {
  lectures: Lecture[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  course: Course | null;
}

/**
 * «Связанные лекции» (spec раздел 8) — Screen-ticket.dc.html, правая панель.
 * В новом макете связь редактируется прямо на экране билета (список +
 * «Привязать лекцию»), а не на отдельном экране правки ответа.
 */
export default function TicketSourcesPanel({ lectures, selectedIds, onChange, course }: Props) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => selectedIds.map((id) => lectures.find((l) => l.id === id)).filter((l): l is Lecture => !!l),
    [selectedIds, lectures]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lectures
      .filter((l) => !selectedIds.includes(l.id))
      .filter((l) => !q || lectureTitle(l).toLowerCase().includes(q))
      .slice(0, 8);
  }, [lectures, selectedIds, query]);

  function add(id: string) {
    onChange([...selectedIds, id]);
    setQuery("");
    setPicking(false);
  }
  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className="c-exam-card c-ticket-aside c-exam-card-pad">
      <h2>Связанные лекции</h2>
      <div className="list" style={{ marginTop: 6 }}>
        {selected.map((l) => (
          <div key={l.id} className="c-ticket-source-row">
            <SubjectCover seed={course?.cover_seed} size={36} />
            <div className="c-ticket-source-tx">
              <span className="t">{lectureTitle(l)}</span>
              <span className="m">
                {l.number ? `Лекция ${l.number}` : "Лекция"}
                {course ? ` · ${courseName(course)}` : ""}
              </span>
            </div>
            <button
              type="button"
              className="c-ticket-source-remove"
              aria-label={`Отвязать «${lectureTitle(l)}»`}
              onClick={() => remove(l.id)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div className="c-ticket-source-pick">
        {picking ? (
          <>
            <input
              className="c-ticket-source-pick-input"
              autoFocus
              placeholder="Найти лекцию…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => window.setTimeout(() => setPicking(false), 150)}
            />
            {results.length > 0 && (
              <div className="c-pop c-menu c-ticket-source-pick-menu" role="listbox">
                {results.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(l.id)}
                  >
                    {lectureTitle(l)}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Button variant="secondary" onClick={() => setPicking(true)}>
            <Icon name="plus" size={18} />
            Привязать лекцию
          </Button>
        )}
      </div>
    </div>
  );
}
