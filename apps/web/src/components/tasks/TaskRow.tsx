import { useState, useRef, useEffect } from "react";
import { Link2, Trash2, MoreHorizontal } from "lucide-react";
import type { Task } from "../../lib/types";
import { courseName } from "../../lib/types";
import { Checkbox, SubjectCover, Menu } from "../ui";
import { isOpen, isOverdue, dueLabel } from "../../lib/taskView";
import { todayStr } from "../../lib/localDate";

interface Props {
  task: Task;
  onToggle: (done: boolean) => void;
  onRename: (title: string) => void;
  onDue: (due: string | null) => void;
  onDelete: () => void;
}

/** Строка задачи (spec 5.1): чекбокс, название (inline), предмет, срок. */
export default function TaskRow({ task, onToggle, onRename, onDue, onDelete }: Props) {
  const done = !isOpen(task);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const subject = task.expand?.subject;
  const lecture = task.expand?.lecture;
  const overdue = isOverdue(task, todayStr());

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== task.title) onRename(next);
    else setDraft(task.title);
  }

  return (
    <div className="ds-task">
      <Checkbox checked={done} onChange={onToggle} label={`Задача «${task.title}»`} />
      <div className="ds-task__main">
        {editing ? (
          <input
            ref={inputRef}
            className="ds-task__title-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(task.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={`ds-task__title-input${done ? " ds-task__title--done" : ""}`}
            style={{ textAlign: "left", cursor: "text" }}
            onClick={() => setEditing(true)}
          >
            {task.title}
          </button>
        )}
        {(subject || lecture) && (
          <div className="ds-task__meta">
            {subject && (
              <>
                <SubjectCover subjectId={subject.id} paletteKey={subject.color} size={16} />
                <span>{courseName(subject)}</span>
              </>
            )}
            {lecture && (
              <>
                <Link2 size={13} aria-hidden="true" />
                <span>Лекция{lecture.number ? ` ${lecture.number}` : ""}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <button
          type="button"
          className={`ds-task__due${overdue ? " ds-task__due--overdue" : ""}`}
          onClick={() => dueRef.current?.showPicker?.() ?? dueRef.current?.focus()}
        >
          {task.due ? dueLabel(task.due) : "Срок"}
        </button>
        <input
          ref={dueRef}
          type="date"
          value={task.due ?? ""}
          onChange={(e) => onDue(e.target.value || null)}
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
            bottom: 0,
            right: 0,
            pointerEvents: "none",
          }}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      <Menu
        trigger={({ ref, onClick, ...aria }) => (
          <button
            ref={ref}
            type="button"
            className="ds-icon-btn"
            aria-label="Действия с задачей"
            onClick={onClick}
            {...aria}
          >
            <MoreHorizontal size={18} />
          </button>
        )}
        items={[
          ...(task.due
            ? [{ label: "Убрать срок", onClick: () => onDue(null) }]
            : []),
          { label: "Удалить", icon: <Trash2 size={16} />, onClick: onDelete, danger: true },
        ]}
      />
    </div>
  );
}
