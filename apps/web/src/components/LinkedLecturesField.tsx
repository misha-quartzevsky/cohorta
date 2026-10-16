import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Lecture } from "../lib/types";
import { lectureTitle } from "../lib/types";

interface Props {
  lectures: Lecture[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}

/** Поле «Связанные лекции» в редакторе билета (spec раздел 8). */
export default function LinkedLecturesField({ lectures, selectedIds, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => selectedIds.map((id) => lectures.find((l) => l.id === id)).filter(Boolean) as Lecture[],
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
    setOpen(false);
  }
  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className="ds-root" style={{ margin: "var(--space-3) 0" }}>
      <label className="ds-field__label" style={{ display: "block", marginBottom: "var(--space-2)" }}>
        Связанные лекции
      </label>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
          {selected.map((l) => (
            <span key={l.id} className="ds-badge ds-badge--neutral" style={{ gap: 6 }}>
              {lectureTitle(l)}
              <button
                type="button"
                onClick={() => remove(l.id)}
                aria-label={`Убрать «${lectureTitle(l)}»`}
                style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", padding: 0 }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ position: "relative", maxWidth: 360 }}>
        <input
          className="ds-input"
          placeholder="Найти лекцию…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        {open && results.length > 0 && (
          <div className="ds-menu" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: 4 }}>
            {results.map((l) => (
              <button
                key={l.id}
                type="button"
                className="ds-menu__item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(l.id)}
              >
                {lectureTitle(l)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
