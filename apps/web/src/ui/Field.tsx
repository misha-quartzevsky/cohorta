import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { useId } from "react";

/** Поля ввода дизайн-системы (.c-field): подпись над полем, ошибка под полем. */

interface Common {
  label?: string;
  hint?: string;
  error?: string;
}

function HintLine({ hint, error }: { hint?: string; error?: string }) {
  const text = error ?? hint;
  if (!text) return null;
  return <small>{text}</small>;
}

export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={`c-field${error ? " err" : ""}${className ? ` ${className}` : ""}`}>
      {label && <label htmlFor={fieldId}>{label}</label>}
      <input id={fieldId} aria-invalid={error ? true : undefined} {...rest} />
      <HintLine hint={hint} error={error} />
    </div>
  );
}

export function Textarea({
  label,
  hint,
  error,
  className,
  id,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={`c-field${error ? " err" : ""}${className ? ` ${className}` : ""}`}>
      {label && <label htmlFor={fieldId}>{label}</label>}
      <textarea id={fieldId} aria-invalid={error ? true : undefined} {...rest} />
      <HintLine hint={hint} error={error} />
    </div>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  id,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={`c-field${error ? " err" : ""}${className ? ` ${className}` : ""}`}>
      {label && <label htmlFor={fieldId}>{label}</label>}
      <select id={fieldId} aria-invalid={error ? true : undefined} {...rest}>
        {children}
      </select>
      <HintLine hint={hint} error={error} />
    </div>
  );
}
