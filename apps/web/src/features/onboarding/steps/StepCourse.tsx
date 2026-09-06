import type { DegreeLevel } from "../../../lib/types";
import { getCourseOptions } from "../courseOptions";

interface Props {
  degreeLevel: DegreeLevel | "";
  value: number | null;
  onChange: (value: number | null) => void;
}

/** Экран 4 — курс. Кнопки-пилюли для типовых ступеней, открытый инпут для «Другое». */
export default function StepCourse({ degreeLevel, value, onChange }: Props) {
  const options = getCourseOptions(degreeLevel);

  if (options === null) {
    return (
      <div className="onb-step">
        <label className="onb-label" htmlFor="onb-course">
          Курс
        </label>
        <input
          id="onb-course"
          className="field"
          type="number"
          min={1}
          value={value ?? ""}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onChange(Number.isNaN(n) || n < 1 ? null : n);
          }}
          placeholder="Введите номер курса"
        />
      </div>
    );
  }

  return (
    <div className="onb-step">
      <span className="onb-label">Курс</span>
      <div className="onb-pills">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            className={"onb-pill" + (value === n ? " onb-pill--on" : "")}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
