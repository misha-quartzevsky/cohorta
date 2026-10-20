import { useNavigate } from "react-router-dom";
import { useTasks } from "../hooks/useTasks";
import { useDecks } from "../hooks/useDecks";
import { isOpen, isOverdue } from "../lib/taskView";
import { pluralRu } from "../lib/format";
import { Icon, StatusChip } from "../ui";
import type { IconName } from "../ui";

interface Item {
  icon: IconName;
  title: string;
  meta: string;
  badge?: number;
  onClick: () => void;
}

/**
 * «Ещё» на телефоне (Screen-m-profile-draft, блок 2): Задачи, Карточки,
 * Поиск. Сюда переехали два пункта нижней панели. Счётчик «к повторению»
 * у карточек из макета не показывается: расписания повторов в базе нет
 * (решение владелицы, B5: карточки — только оболочка).
 */
export default function MorePage() {
  const navigate = useNavigate();
  const { tasks } = useTasks();
  const { decks } = useDecks();

  const open = tasks.filter(isOpen);
  const overdue = open.filter((t) => isOverdue(t)).length;
  const decksN = decks.length;

  const items: Item[] = [
    {
      icon: "task",
      title: "Задачи",
      meta:
        `${open.length} ${pluralRu(open.length, ["открытая", "открытые", "открытых"])}` +
        (overdue > 0
          ? `, ${overdue} ${pluralRu(overdue, ["просрочена", "просрочено", "просрочено"])}`
          : ""),
      badge: overdue,
      onClick: () => navigate("/tasks"),
    },
    {
      icon: "cards",
      title: "Карточки",
      meta: `${decksN} ${pluralRu(decksN, ["колода", "колоды", "колод"])}`,
      onClick: () => navigate("/decks"),
    },
  ];

  return (
    <div className="c-more">
      <div className="c-more-head">
        <h1>Занятия</h1>
        <span>Остальные разделы</span>
      </div>
      <div className="c-more-list">
        {items.map((it) => (
          <button key={it.title} type="button" className="c-more-row" onClick={it.onClick}>
            <span className="ic">
              <Icon name={it.icon} size={22} />
            </span>
            <span className="tx">
              <span className="t">{it.title}</span>
              <span className="m">{it.meta}</span>
            </span>
            {it.badge ? <StatusChip tone="danger">{it.badge}</StatusChip> : null}
            <Icon name="chev" size={18} className="chev" />
          </button>
        ))}
      </div>
    </div>
  );
}
