interface Props {
  width?: number | string;
  height?: number | string;
  radius?: string;
  className?: string;
}

/** Скелетон загрузки (spec 1A.7): статичный фон, очень медленная анимация. */
export default function Skeleton({
  width = "100%",
  height = 16,
  radius,
  className,
}: Props) {
  return (
    <div
      className={`ds-skeleton${className ? ` ${className}` : ""}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
