/**
 * Выбор периода: кнопка «Семестр 3 ⌄» и окно «Период» (Screen-m-lectures-period).
 * На телефоне окно выезжает снизу шторкой, на компьютере то же окно по центру
 * (раскрытый список на десктопе в макетах не нарисован).
 */

import { useState } from "react";

import { Icon, Modal } from "../../ui";

export interface PeriodOption {
  value: string;
  label: string;
}

interface Props {
  options: PeriodOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function PeriodSelect({ options, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  // На кнопке — короткая подпись без «, сейчас».
  const buttonLabel = (current?.label ?? "Период").replace(/, сейчас$/, "");

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
