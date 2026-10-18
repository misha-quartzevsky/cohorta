import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

interface Props {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Пустое/системное состояние (.c-empty) — волна D покрывает ими все списки. */
export default function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={`c-empty${className ? ` ${className}` : ""}`}>
      {icon && (
        <span className="ico">
          <Icon name={icon} />
        </span>
      )}
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
