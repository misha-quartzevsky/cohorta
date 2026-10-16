interface Props {
  /** 0–100 */
  value: number;
  /** Цвет заполнения (CSS-переменная), по умолчанию ink. */
  color?: string;
  thin?: boolean;
  label?: string;
}

/** Полоса прогресса (spec 1A.7). role=progressbar с aria-valuenow. */
export default function ProgressBar({
  value,
  color = "var(--color-ink)",
  thin = false,
  label,
}: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`ds-progress${thin ? " ds-progress--thin" : ""}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="ds-progress__fill"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
