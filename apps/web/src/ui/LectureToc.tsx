export interface TocItem {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

interface Props {
  items: TocItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Оглавление лекции (.c-toc, раздел B1 инструкции): строится из H2/H3
 * документа, подсветка текущего раздела, клик прокручивает. Длинный
 * список прокручивается — контейнер даёт высоту и `overflow`.
 */
export default function LectureToc({ items, activeId, onSelect, className }: Props) {
  if (items.length === 0) return null;
  return (
    <nav className={`c-toc${className ? ` ${className}` : ""}`} aria-label="Содержание лекции">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={[item.level === 3 ? "h3" : "", item.id === activeId ? "on" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-current={item.id === activeId ? "true" : undefined}
          onClick={(e) => {
            e.preventDefault();
            onSelect(item.id);
          }}
        >
          <span title={item.text}>{item.text}</span>
        </a>
      ))}
    </nav>
  );
}
