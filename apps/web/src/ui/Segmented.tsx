export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

interface Props<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
}

/** Переключатель режимов (.c-seg), например Соло/Группа. */
export default function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  className,
  ...rest
}: Props<T>) {
  return (
    <div
      className={`c-seg${className ? ` ${className}` : ""}`}
      role="radiogroup"
      aria-label={rest["aria-label"]}
    >
      {options.map((opt) => (
        <span
          key={opt.value}
          role="radio"
          aria-checked={opt.value === value}
          tabIndex={opt.value === value ? 0 : -1}
          className={opt.value === value ? "on" : ""}
          onClick={() => onChange(opt.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChange(opt.value);
              return;
            }
            const idx = options.findIndex((o) => o.value === value);
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(options[(idx + 1) % options.length].value);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(options[(idx - 1 + options.length) % options.length].value);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {opt.label}
        </span>
      ))}
    </div>
  );
}
