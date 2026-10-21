import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";
import { isoToRuDate, maskRuDate, ruDateToIso } from "../lib/dateInput";

interface Props {
  label?: string;
  hint?: string;
  error?: string;
  /** ISO `YYYY-MM-DD` или "". */
  value: string;
  /** `valid` = false, если в поле набрана неполная или несуществующая дата. */
  onChange: (iso: string, valid: boolean) => void;
}

/**
 * Дата в виде ДД.ММ.ГГГГ (день, месяц, год), как принято у нас, а не по языку браузера.
 * Календарь открывается кнопкой справа.
 */
export default function DateField({ label, hint, error, value, onChange }: Props) {
  const id = useId();
  const [text, setText] = useState(isoToRuDate(value));
  const picker = useRef<HTMLInputElement>(null);

  // Значение пришло снаружи (сброс формы): показываем его, не трогая то, что человек печатает.
  useEffect(() => {
    if (value !== ruDateToIso(text)) setText(isoToRuDate(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function type(raw: string) {
    const next = maskRuDate(raw);
    setText(next);
    const iso = ruDateToIso(next);
    onChange(iso, next === "" || iso !== "");
  }

  const text2 = error ?? hint;
  return (
    <div className={`c-field c-date${error ? " err" : ""}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <div className="c-date-box">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="ДД.ММ.ГГГГ"
          value={text}
          aria-invalid={error ? true : undefined}
          onChange={(e) => type(e.target.value)}
        />
        <button
          type="button"
          className="c-date-btn"
          aria-label="Открыть календарь"
          onClick={() => picker.current?.showPicker?.()}
        >
          <Icon name="cal" size={18} />
        </button>
        <input
          ref={picker}
          type="date"
          className="c-date-native"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          onChange={(e) => {
            setText(isoToRuDate(e.target.value));
            onChange(e.target.value, true);
          }}
        />
      </div>
      {text2 && <small>{text2}</small>}
    </div>
  );
}
