import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { useId } from "react";
import { AlertCircle } from "lucide-react";

/** Поля ввода дизайн-основы (spec 1A.7): label над полем, ошибка под полем. */

interface Common {
  label?: string;
  error?: string;
}

function ErrorLine({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <span className="ds-field__error">
      <AlertCircle size={14} aria-hidden="true" />
      {error}
    </span>
  );
}

export function Input({
  label,
  error,
  className,
  id,
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="ds-field">
      {label && (
        <label className="ds-field__label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <input
        id={fieldId}
        className={`ds-input${error ? " ds-input--error" : ""}${
          className ? ` ${className}` : ""
        }`}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      <ErrorLine error={error} />
    </div>
  );
}

export function Textarea({
  label,
  error,
  className,
  id,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="ds-field">
      {label && (
        <label className="ds-field__label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        className={`ds-textarea${error ? " ds-textarea--error" : ""}${
          className ? ` ${className}` : ""
        }`}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      <ErrorLine error={error} />
    </div>
  );
}

export function Select({
  label,
  error,
  className,
  id,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="ds-field">
      {label && (
        <label className="ds-field__label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <select
        id={fieldId}
        className={`ds-select${error ? " ds-select--error" : ""}${
          className ? ` ${className}` : ""
        }`}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </select>
      <ErrorLine error={error} />
    </div>
  );
}
