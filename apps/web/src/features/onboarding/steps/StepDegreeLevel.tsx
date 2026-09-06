import type { DegreeLevel } from "../../../lib/types";

const DEGREES: { id: DegreeLevel; label: string }[] = [
  { id: "bachelor", label: "Бакалавриат" },
  { id: "specialist", label: "Специалитет" },
  { id: "master", label: "Магистратура" },
  { id: "other", label: "Другое" },
];

interface Props {
  value: DegreeLevel | "";
  custom: string;
  onChange: (patch: { degreeLevel?: DegreeLevel; custom?: string }) => void;
}

/** Экран 3 — ступень образования (от неё зависит диапазон курса). */
export default function StepDegreeLevel({ value, custom, onChange }: Props) {
  return (
    <div className="onb-step">
      <span className="onb-label">Уровень образования</span>
      <div className="onb-options onb-options--grid">
        {DEGREES.map((d) => (
          <button
            key={d.id}
            type="button"
            className={"onb-option" + (value === d.id ? " onb-option--on" : "")}
            onClick={() => onChange({ degreeLevel: d.id })}
          >
            {d.label}
          </button>
        ))}
      </div>
      {value === "other" && (
        <input
          className="field onb-mt"
          value={custom}
          onChange={(e) => onChange({ custom: e.target.value })}
          placeholder="Опишите свою форму обучения"
          autoComplete="off"
        />
      )}
    </div>
  );
}
