/**
 * «Импорт билетов» (Screen-ticket-import, Screen-m-ticket-import): один экран для личного экзамена и для
 * подгруппы экзамена группы. Меняются только крошки, подпись и то, куда сохраняются билеты (`onSubmit`).
 *
 * Правила: один билет на строку, цифры и маркеры в начале убираются, билеты получают следующие номера
 * после уже существующих, в порядке текста. Кнопка «Добавить N билетов» одна на экране и остаётся
 * на виду при прокрутке; пока нет ни одной строки, кнопки нет.
 */

import { useLayoutEffect, useRef, useState, type ClipboardEvent } from "react";
import { Link } from "react-router-dom";

import { Button, EmptyState, Icon, StatusChip } from "../../ui";
import { errorMessage, pluralRu } from "../../lib/format";
import { numberAfter, parseTicketsFromClipboard, type ParsedTicket } from "../../lib/examImport";

interface Props {
  /** Крошки на десктопе. */
  crumbs: { label: string; to?: string }[];
  /** «‹ Экзамен» на телефоне. */
  back: { label: string; to: string };
  /** «Гражданское право · экзамен 12 января» или «… · дата экзамена не задана». */
  subtitle: string;
  /** Номера билетов, которые уже есть в этом списке. */
  existingNumbers: number[];
  /** Сохраняет билеты с уже назначенными номерами. */
  onSubmit: (tickets: ParsedTicket[]) => Promise<void>;
  /** Что делать после сохранения (обычно вернуться на экран экзамена). */
  onDone: () => void;
}

export function ticketsWord(n: number): string {
  return `${n} ${pluralRu(n, ["билет", "билета", "билетов"])}`;
}

export default function ImportScreen({ crumbs, back, subtitle, existingNumbers, onSubmit, onDone }: Props) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedTicket[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  const numbered = numberAfter(parsed, existingNumbers);
  const label = saving ? "Сохранение…" : `Добавить ${ticketsWord(numbered.length)}`;

  // высота поля растёт по содержимому, но не меньше 200 px
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(200, el.scrollHeight)}px`;
  }, [raw]);

  function parse(html: string, text: string) {
    setParsed(text.trim() || html.trim() ? parseTicketsFromClipboard(html, text).tickets : []);
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html || text) {
      e.preventDefault();
      const el = e.currentTarget;
      // вставка в место курсора: список целиком пересобирается из всего текста поля
      const next = el.value.slice(0, el.selectionStart) + text + el.value.slice(el.selectionEnd);
      setRaw(next);
      // HTML используем, только если в поле больше ничего нет: иначе строки поля и буфера смешались бы
      parse(el.value.trim() ? "" : html, next);
    }
  }

  async function save() {
    if (numbered.length === 0 || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit(numbered);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <div className="c-import">
      <div className="c-exam-m-crumb">
        <Link to={back.to}>
          <Icon name="chev" size={18} style={{ transform: "scaleX(-1)" }} />
          {back.label}
        </Link>
      </div>
      <div className="c-exam-crumb">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <Icon name="chev" size={14} />}
            {c.to ? <Link to={c.to}>{c.label}</Link> : <span className="current">{c.label}</span>}
          </span>
        ))}
      </div>
      <div className="c-import-head">
        <div>
          <h1>
            <span className="c-form-d">Импорт билетов</span>
            <span className="c-form-m">Вставить список</span>
          </h1>
          <span>{subtitle}</span>
        </div>
        {numbered.length > 0 && (
          <Button variant="primary" className="c-form-d" onClick={() => void save()} disabled={saving}>
            {label}
          </Button>
        )}
      </div>

      {error && <EmptyState icon="info" title="Не удалось сохранить" description={error} />}

      <div className="c-import-cols">
        <div className="c-import-col c-import-textarea">
          <span className="label">
            <span className="c-form-d">Вставь список билетов</span>
            <span className="c-form-m">Список билетов</span>
          </span>
          <div className="c-field">
            <textarea
              ref={area}
              aria-label="Список билетов"
              placeholder="Вставь список вопросов, по одному в строке…"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                parse("", e.target.value);
              }}
              onPaste={onPaste}
            />
          </div>
          <span className="hint">
            <span className="c-form-d">Один билет на строку. Номера и точки в начале мы уберём сами.</span>
            <span className="c-form-m">Один билет на строку. Номера можно не писать.</span>
          </span>
        </div>

        <div className="c-import-col">
          <span className="label c-import-found">
            <span className="c-form-d">Так билеты добавятся</span>
            <span className="c-form-m">Найдено {ticketsWord(numbered.length)}</span>
          </span>
          {numbered.length === 0 ? (
            <span className="hint">Здесь появится список после вставки.</span>
          ) : (
            <>
              <span className="hint c-form-d">Найдено {ticketsWord(numbered.length)}.</span>
              <div className="c-import-preview">
                {numbered.map((t) => (
                  <div key={t.number} className="c-import-preview-row">
                    <span className="num">{t.number}</span>
                    <span className="q">{t.question}</span>
                    <StatusChip tone="neutral">Новый</StatusChip>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {numbered.length > 0 && (
        <div className="c-import-m-cta">
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {label}
          </Button>
        </div>
      )}
    </div>
  );
}
