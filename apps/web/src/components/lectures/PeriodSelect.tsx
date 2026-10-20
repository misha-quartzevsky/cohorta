/**
 * Выбор периода. Телефон (Screen-m-lectures-period): кнопка «Семестр 3 ⌄» и
 * шторка «Период». Компьютер (Screen-lectures-period): кнопка «Период Семестр 3 ⌄»
 * и список под ней — у текущего «текущий ✓», внизу «Все периоды».
 */

import { useEffect, useRef, useState } from "react";

import { Icon, Modal } from "../../ui";
import { ALL_PERIODS } from "../../lib/lectureListRules";

export interface PeriodOption {
  value: string;
  label: string;
}

interface Props {
  options: PeriodOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Список под кнопкой (компьютер) вместо шторки. */
  popover?: boolean;
}

const CURRENT_SUFFIX = /, сейчас$/;

export default function PeriodSelect({ options, value, onChange, className, popover }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);
  const short = (o: PeriodOption) => o.label.replace(CURRENT_SUFFIX, "");
  const buttonLabel = popover
    ? value === ALL_PERIODS
      ? "Все периоды"
      : current
        ? short(current)
        : "Период"
    : (current ? short(current) : "Период");

  useEffect(() => {
    if (!popover || !open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [popover, open]);

  if (popover) {
    return (
      <div className="c-lec-period-wrap" ref={rootRef}>
        <button
          type="button"
          className={`c-lec-period wide${className ? ` ${className}` : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Период: ${buttonLabel}`}
        >
          <span className="lbl">Период</span>
          <b>{buttonLabel}</b>
          <Icon name="chevd" size={16} />
        </button>
        {open && (
          <div className="c-pop c-lec-period-list" role="listbox" aria-label="Период">
            {options.map((o) => {
              const isCurrent = CURRENT_SUFFIX.test(o.label);
              const on = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={on ? "on" : ""}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span>{o.value === ALL_PERIODS ? "Все периоды" : short(o)}</span>
                  <span className="hint">
                    {isCurrent && "текущий"}
                    {on && <Icon name="check" size={16} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`c-lec-period${className ? ` ${className}` : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Период: ${buttonLabel}`}
      >
        {buttonLabel}
        <Icon name="chevd" size={16} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Период" className="c-sheet-dialog" bare>
        <h2 className="c-pick-title">Период</h2>
        <div className="c-pick-list" role="listbox" aria-label="Период">
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
              {o.value === value && <Icon name="check" size={18} className="c-lec-period-check" />}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
