export interface Segment<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface Props<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

/** Сегмент-контрол (spec 1A.7): активный сегмент — чёрный фон, белый текст. */
export default function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div className="ds-segmented" role="tablist" aria-label={ariaLabel}>
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <button
            key={seg.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`ds-segmented__item${
              active ? " ds-segmented__item--active" : ""
            }`}
            onClick={() => onChange(seg.value)}
          >
            {seg.label}
            {seg.count != null && (
              <span className="ds-segmented__count">{seg.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
