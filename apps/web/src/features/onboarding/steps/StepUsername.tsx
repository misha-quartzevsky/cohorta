import { isValidHandle } from "../handle";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Ошибка из `setUsername` (например, логин занят). */
  error: string;
}

/** Экран «Адрес профиля» — уникальный логин, он же поддомен. */
export default function StepUsername({ value, onChange, error }: Props) {
  const trimmed = value.trim();
  const formatHint =
    trimmed.length > 0 && !isValidHandle(trimmed)
      ? "Только строчные латинские буквы, цифры и дефис (3–40 символов)."
      : "";

  return (
    <div className="onb-step">
      <label className="onb-label" htmlFor="onb-username">
        Адрес профиля
      </label>
      <div className="onb-handle">
        <input
          id="onb-username"
          className="field onb-handle-input"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          placeholder="dasha-konspekt"
          autoComplete="off"
          maxLength={40}
          spellCheck={false}
        />
        <span className="onb-handle-suffix">.cohorta.ru</span>
      </div>
      <p className="onb-hint">
        Личная ссылка: <b>{trimmed || "username"}</b>.cohorta.ru
      </p>
      {(formatHint || error) && (
        <p className="onb-error">{error || formatHint}</p>
      )}
    </div>
  );
}
