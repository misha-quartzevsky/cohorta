import { Check } from "lucide-react";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** Круглый чекбокс задачи (spec 1A.7): выполненный — фон ink, белая галочка. */
export default function Checkbox({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`c-check${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <Check size={13} strokeWidth={3} aria-hidden="true" />
    </button>
  );
}
