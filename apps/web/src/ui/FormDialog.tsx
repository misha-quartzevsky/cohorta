import { useId, useState, type FormEvent, type ReactNode } from "react";
import Modal from "./Modal";
import Button from "./Button";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Одна строка под заголовком (Screen-forms-create). */
  subtitle?: string;
  /** Подпись есть только на десктопе (на телефоне её роль у строки в теле формы). */
  subtitleDesktopOnly?: boolean;
  /** Подпись главной кнопки: «Создать», «Сохранить». */
  submitLabel: string;
  /** Возвращает false, если сохранять нельзя (ошибка показана в самой форме) — окно остаётся. */
  onSubmit: () => Promise<boolean | void> | boolean | void;
  /** Вторая кнопка рядом с главной (например «Сохранить и ещё»), тёмная по макету. */
  secondary?: { label: string; onClick: () => Promise<boolean | void> | boolean | void };
  /** Слева в подвале, например «Удалить пару». */
  leading?: ReactNode;
  children: ReactNode;
}

/**
 * Шаблон всех форм создания (Screen-forms-create): окно по центру, на телефоне
 * шторка снизу (Modal), подпись над полем, «Отмена» и одна главная кнопка.
 * Enter в поле отправляет форму, Esc и крестик закрывают.
 */
export default function FormDialog({
  open,
  onClose,
  title,
  subtitle,
  subtitleDesktopOnly,
  submitLabel,
  onSubmit,
  secondary,
  leading,
  children,
}: Props) {
  const formId = useId();
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<boolean | void> | boolean | void, closeAfter: boolean) {
    setBusy(true);
    try {
      const result = await fn();
      if (result !== false && closeAfter) onClose();
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!busy) void run(onSubmit, true);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          {leading && <div className="c-form-lead">{leading}</div>}
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          {secondary && (
            <Button variant="secondary" disabled={busy} onClick={() => void run(secondary.onClick, false)}>
              {secondary.label}
            </Button>
          )}
          <Button variant="primary" type="submit" form={formId} loading={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} className="c-form" onSubmit={handleSubmit} noValidate>
        {subtitle && <p className={`c-form-sub${subtitleDesktopOnly ? " c-form-d" : ""}`}>{subtitle}</p>}
        {children}
      </form>
    </Modal>
  );
}
