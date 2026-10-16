import type { ReactNode } from "react";

interface Props {
  title: string;
  text?: string;
  /** До трёх действий (кнопки). */
  actions?: ReactNode;
  /** Схематичная иллюстрация из пунктирных контуров (по умолчанию дефолтная). */
  art?: ReactNode;
}

/** Пустое состояние (spec 1A.7): пунктирная иллюстрация, без цветных картинок. */
export default function EmptyState({ title, text, actions, art }: Props) {
  return (
    <div className="ds-empty">
      <div className="ds-empty__art">{art ?? <DefaultArt />}</div>
      <div className="ds-empty__title">{title}</div>
      {text && <p className="ds-empty__text ds-body">{text}</p>}
      {actions && <div className="ds-empty__actions">{actions}</div>}
    </div>
  );
}

function DefaultArt() {
  return (
    <svg viewBox="0 0 96 96" width="96" height="96" fill="none" aria-hidden="true">
      <rect
        x="14"
        y="22"
        width="68"
        height="52"
        rx="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      <line
        x1="26"
        y1="40"
        x2="58"
        y2="40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="26"
        y1="52"
        x2="70"
        y2="52"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
