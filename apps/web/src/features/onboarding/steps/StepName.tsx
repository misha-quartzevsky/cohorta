interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** Экран «Как тебя зовут?» — имя для обращения внутри сервиса (`users.name`). */
export default function StepName({ value, onChange }: Props) {
  return (
    <div className="onb-step">
      <label className="onb-label" htmlFor="onb-name">
        Как тебя зовут?
      </label>
      <input
        id="onb-name"
        className="field"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Например, Даша"
        autoComplete="given-name"
        maxLength={80}
      />
      <p className="onb-hint">Так к тебе будут обращаться внутри Cohorta.</p>
    </div>
  );
}
