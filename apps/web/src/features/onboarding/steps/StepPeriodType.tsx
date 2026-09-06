import type { PeriodType } from "../../../lib/types";

const TYPES: { id: PeriodType; label: string }[] = [
  { id: "semester", label: "Семестры" },
  { id: "trimester", label: "Триместры" },
  { id: "quarter", label: "Четверти" },
  { id: "custom", label: "Своё название" },
];

interface Props {
  value: PeriodType | "";
  customWord: string;
  onChange: (patch: { type?: PeriodType; customWord?: string }) => void;
}

/** Экран 5 — тип периода обучения. «Своё название» → произвольное слово. */
export default function StepPeriodType({ value, customWord, onChange }: Props) {
  return (
    <div className="onb-step">
      <span className="onb-label">Тип периода обучения</span>
      <div className="onb-options onb-options--grid">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={"onb-option" + (value === t.id ? " onb-option--on" : "")}
            onClick={() => onChange({ type: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <input
          className="field onb-mt"
          value={customWord}
          onChange={(e) => onChange({ customWord: e.target.value })}
          placeholder="Например: модуль"
          autoComplete="off"
        />
      )}
    </div>
  );
}
