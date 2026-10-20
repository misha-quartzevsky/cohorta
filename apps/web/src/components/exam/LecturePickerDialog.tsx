import { useEffect, useMemo, useState } from "react";
import { FormDialog, Segmented, SubjectCover } from "../../ui";
import { Search } from "lucide-react";
import type { Course, Lecture } from "../../lib/types";
import { courseName, lectureTitle } from "../../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  ticketNumber: number;
  /** Мои лекции предмета. */
  mine: Lecture[];
  course: Course | null;
  /** Чужие лекции, открытые мне. */
  opened: Lecture[];
  selectedIds: string[];
  onSave: (ids: string[]) => Promise<void>;
}

type Tab = "mine" | "opened";

/** «Привязать лекции к билету» (Screen-ticket-lecture-picker, Screen-m-lecture-picker). */
export default function LecturePickerDialog({
  open,
  onClose,
  ticketNumber,
  mine,
  course,
  opened,
  selectedIds,
  onSave,
}: Props) {
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (!open) return;
    setTab("mine");
    setQuery("");
    setPicked(selectedIds);
    // Только при открытии: правки выбора внутри окна не должны сбрасываться.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tab === "mine" ? mine : opened).filter((l) => !q || lectureTitle(l).toLowerCase().includes(q));
  }, [tab, mine, opened, query]);

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function subtitle(l: Lecture) {
    const c = tab === "mine" ? course : l.expand?.field;
    return [l.number ? `Лекция ${l.number}` : "Лекция", c ? courseName(c) : ""].filter(Boolean).join(" · ");
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={`Привязать лекции к билету ${ticketNumber}`}
      subtitle="Нужны, чтобы сверить ответ с конспектом. Необязательно."
      subtitleDesktopOnly
      submitLabel={`Привязать (${picked.length})`}
      onSubmit={async () => {
        await onSave(picked);
      }}
    >
      <label className="c-picker-search c-form-d">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          placeholder="Найти лекцию"
          aria-label="Найти лекцию"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <Segmented<Tab>
        aria-label="Какие лекции показать"
        value={tab}
        onChange={setTab}
        className="c-picker-tabs"
        options={[
          { value: "mine", label: `Мои ${mine.length}` },
          { value: "opened", label: `Открытые мне ${opened.length}` },
        ]}
      />
      <div className="c-picker-list">
        {list.map((l) => {
          const on = picked.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              className="c-picker-row"
              onClick={() => toggle(l.id)}
            >
              <span className={`c-check${on ? " on" : ""}`} aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              </span>
              <SubjectCover seed={(tab === "mine" ? course : l.expand?.field)?.cover_seed} size={36} />
              <span className="tx">
                <span className="t">{lectureTitle(l)}</span>
                <span className="m">{subtitle(l)}</span>
              </span>
            </button>
          );
        })}
        {list.length === 0 && (
          <p className="c-picker-note">{tab === "opened" ? "Тебе пока не открыли ни одной лекции." : "Ничего не нашлось."}</p>
        )}
      </div>
      {tab === "opened" && <p className="c-picker-note">Закрытые для тебя лекции здесь не показываются.</p>}
    </FormDialog>
  );
}
