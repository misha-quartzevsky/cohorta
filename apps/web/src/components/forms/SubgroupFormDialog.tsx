import { useEffect, useState } from "react";
import { FormDialog, Input } from "../../ui";
import { Ava } from "../group/common";
import { createSubgroup } from "../../services/groupExamApi";
import type { RosterPerson } from "../../services/groupApi";
import { errorMessage } from "../../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  examId: string;
  examTitle: string;
  /** Состав группы (включая меня). */
  roster: RosterPerson[];
  myId: string;
  /** Кто уже в подгруппе этого экзамена: выбрать нельзя (один человек, одна подгруппа). */
  taken: string[];
  onCreated: (subgroupId: string) => void;
}

/**
 * «Новая подгруппа» (Screen-forms-create, Screen-m-form-subgroup): название и участники.
 * Я состою в ней всегда; человек, уже состоящий в другой подгруппе экзамена, недоступен.
 * Название чужой подгруппы не показывается (подгруппу видят только её участники): строка «уже в другой подгруппе».
 */
export default function SubgroupFormDialog({ open, onClose, examId, examTitle, roster, myId, taken, onCreated }: Props) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setPicked([]);
    setError("");
  }, [open]);

  const others = roster.filter((p) => p.id !== myId);
  const me = roster.find((p) => p.id === myId);

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit() {
    if (!name.trim()) {
      setError("Введи название подгруппы");
      return false;
    }
    try {
      const r = await createSubgroup(examId, name, picked);
      onCreated(r.id);
    } catch (e) {
      setError("Не удалось создать подгруппу: " + errorMessage(e));
      return false;
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Новая подгруппа"
      subtitle={`Для экзамена «${examTitle}». Один человек состоит в одной подгруппе на экзамен.`}
      submitLabel="Создать подгруппу"
      onSubmit={submit}
    >
      <Input
        label="Название"
        value={name}
        placeholder="Например, Вечерняя подготовка"
        error={error || undefined}
        onChange={(e) => {
          setName(e.target.value);
          setError("");
        }}
        autoFocus
      />
      <div className="c-sg-field">
        <span className="c-sg-label">Участники</span>
        <div className="c-sg-people" role="group" aria-label="Участники подгруппы">
          <div className="c-sg-row on fixed">
            <span className="c-check on" aria-hidden="true">
              <CheckGlyph />
            </span>
            <Ava id={myId} name={me?.name ?? ""} avatar={me?.avatar} size="xs" />
            <span className="tx">
              <span className="t">Ты</span>
            </span>
          </div>
          {others.map((p) => {
            const busy = taken.includes(p.id);
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-disabled={busy}
                disabled={busy}
                className={`c-sg-row${busy ? " busy" : ""}`}
                onClick={() => toggle(p.id)}
              >
                <span className={`c-check${on ? " on" : ""}`} aria-hidden="true">
                  <CheckGlyph />
                </span>
                <Ava id={p.id} name={p.name} avatar={p.avatar} size="xs" />
                <span className="tx">
                  <span className="t">{p.name}</span>
                  {busy && <span className="m">уже в другой подгруппе</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </FormDialog>
  );
}

function CheckGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}
