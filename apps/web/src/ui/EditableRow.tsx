import { useEffect, useRef, useState, type ReactNode } from "react";

import { useMediaQuery } from "../hooks/useMediaQuery";
import Button from "./Button";
import { Input } from "./Field";
import Modal from "./Modal";
export { RowSaveError } from "./rowSaveError";

/**
 * Правка профиля одним компонентом (Screen-settings-inline): строка
 * «подпись, значение, Изменить» превращается в поле на месте с кнопками
 * «Сохранить» (одна оранжевая) и «Отмена». Ошибка — подсказкой под полем,
 * кнопка «Сохранить» остаётся. После сохранения строка возвращается в
 * просмотр с пометкой «Сохранено» на пару секунд. Выбор из списка на
 * телефоне открывается шторкой, выбор сразу сохраняется.
 */

export interface PickOption {
  value: string;
  label: string;
}

interface BaseProps {
  label: string;
  /** Значение в режиме просмотра. */
  value: ReactNode;
  /** Строка мелким шрифтом под значением (и под полем при правке). */
  hint?: ReactNode;
  /** Текст ссылки справа: по умолчанию «Изменить». */
  actionLabel?: string;
}

interface TextProps extends BaseProps {
  kind: "text";
  initial: string;
  placeholder?: string;
  /** Вернуть текст ошибки или "" (проверка до записи). */
  validate?: (value: string) => string;
  /** Записать; ошибку бросить как RowSaveError (текст попадёт под поле). */
  onSave: (value: string) => Promise<void>;
}

interface SelectProps extends BaseProps {
  kind: "select";
  initial: string;
  options: PickOption[];
  /** Заголовок шторки на телефоне. */
  sheetTitle: string;
  onSave: (value: string) => Promise<void>;
}

interface CustomProps<T> extends BaseProps {
  kind: "custom";
  initial: T;
  /** Поля правки. `error` — ошибка записи (показать под полем). */
  render: (draft: T, setDraft: (next: T) => void, error: string) => ReactNode;
  validate?: (draft: T) => string;
  onSave: (draft: T) => Promise<void>;
}

type Props<T = unknown> = TextProps | SelectProps | CustomProps<T>;

/** Список выбора: на телефоне — шторка, на компьютере — обычный select. */
export function PickField({
  label,
  value,
  options,
  sheetTitle,
  onChange,
}: {
  label?: string;
  value: string;
  options: PickOption[];
  sheetTitle: string;
  onChange: (value: string) => void;
}) {
  const phone = useMediaQuery("(max-width: 639px)");
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  if (!phone) {
    return (
      <div className="c-field">
        {label && <label>{label}</label>}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <>
      <div className="c-field">
        {label && <label>{label}</label>}
        <button type="button" className="c-pick-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <span>{current?.label ?? "Выбрать"}</span>
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={sheetTitle} className="c-sheet-dialog" bare>
        <h2 className="c-pick-title">{sheetTitle}</h2>
        <div className="c-pick-list" role="listbox" aria-label={sheetTitle}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={o.value === value ? "on" : ""}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {o.value === value && <span className="dot" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

export default function EditableRow<T = unknown>(props: Props<T>) {
  const { label, value, hint, actionLabel = "Изменить" } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>(props.initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const start = () => {
    setDraft(props.initial);
    setError("");
    setSaved(false);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError("");
  };

  const commit = async (override?: unknown) => {
    const next = override !== undefined ? override : draft;
    const problem =
      props.kind === "text"
        ? (props.validate?.(String(next)) ?? "")
        : props.kind === "custom"
          ? (props.validate?.(next as T) ?? "")
          : "";
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (props.kind === "custom") await props.onSave(next as T);
      else await props.onSave(String(next));
      setEditing(false);
      setSaved(true);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Не удалось сохранить. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="c-erow">
        <div className="tx">
          <span className="lbl">{label}</span>
          <span className="val">{value}</span>
          {hint ? <span className="hint">{hint}</span> : null}
          {saved ? (
            <span className="saved" role="status">
              Сохранено
            </span>
          ) : null}
        </div>
        <button type="button" className="act" onClick={start}>
          {actionLabel}
        </button>
      </div>
    );
  }

  let field: ReactNode;
  if (props.kind === "text") {
    field = (
      <Input
        label={label}
        value={String(draft)}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError("");
        }}
        placeholder={props.placeholder}
        error={error || undefined}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") cancel();
        }}
      />
    );
  } else if (props.kind === "select") {
    field = (
      <PickField
        label={label}
        value={String(draft)}
        options={props.options}
        sheetTitle={props.sheetTitle}
        onChange={(v) => {
          setDraft(v);
          // на телефоне выбор из шторки сохраняется сразу
          if (window.matchMedia("(max-width: 639px)").matches) void commit(v);
        }}
      />
    );
  } else {
    field = props.render(draft as T, setDraft as (n: T) => void, error);
  }

  return (
    <div className="c-erow editing">
      {field}
      {props.kind !== "text" && error ? <small className="c-erow-err">{error}</small> : null}
      {hint && !error ? <span className="hint">{hint}</span> : null}
      <div className="btns">
        <Button variant="primary" size="sm" onClick={() => void commit()} loading={busy}>
          Сохранить
        </Button>
        <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
