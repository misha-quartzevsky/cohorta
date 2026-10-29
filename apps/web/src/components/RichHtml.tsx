/**
 * ============================================
 *  RichHtml.tsx — единственное место, где пользовательский HTML попадает в страницу
 * ============================================
 *
 * Все `dangerouslySetInnerHTML` с лекциями, билетами и карточками идут через этот компонент: HTML проходит
 * `sanitizeHtml` (DOMPurify, белый список Tiptap). Остальные пропсы уходят на обёртку (`ref`, `className`,
 * обработчики). Аудит безопасности 2026-10, C-1.
 */
import { useMemo, type ComponentPropsWithRef } from "react";
import { sanitizeHtml } from "../lib/sanitizeHtml";

interface Props extends Omit<ComponentPropsWithRef<"div">, "dangerouslySetInnerHTML" | "children"> {
  /** Сырой HTML (чужой или свой: очищается в любом случае). */
  html: string;
}

export default function RichHtml({ html, ...rest }: Props) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  return <div {...rest} dangerouslySetInnerHTML={{ __html: clean }} />;
}
