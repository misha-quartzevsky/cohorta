export interface PillOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

interface Props<T extends string = string> {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
}

/** Таб-пилюли (.c-pills, spec 1A.7 Tabs-pill): активный пункт — чёрный. */
export default function Pills<T extends string = string>({
  options,
  value,
  onChange,
  ...rest
}: Props<T>) {
  return (
    <div className="c-pills" role="tablist" aria-label={rest["aria-label"]}>
      {options.map((opt) => (
        <span
          key={opt.value}
          role="tab"
          aria-selected={opt.value === value}
          tabIndex={0}
          className={opt.value === value ? "on" : ""}
          onClick={() => onChange(opt.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChange(opt.value);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {opt.label}
          {opt.count != null && ` ${opt.count}`}
        </span>
      ))}
    </div>
  );
}
