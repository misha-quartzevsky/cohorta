import { NavLink } from "react-router-dom";
import { useSubjectTabCounts } from "../hooks/useSubjectTabCounts";

export type SubjectTab = "lectures" | "pairs" | "exam";

interface Props {
  /** Адрес предмета: `/s/:sem/:courseSlug`. */
  base: string;
  courseId: string | undefined;
  active: SubjectTab;
}

/**
 * Вкладки предмета «Лекции N | Пары N | Экзамен» (Screen-exam, Screen-m-exam,
 * Screen-m-subject-pairs, Screen-m-subject-lectures). Один вид на трёх экранах:
 * на компьютере сегмент-пилюля, на телефоне ряд чипов (переключается по CSS).
 */
export default function SubjectTabs({ base, courseId, active }: Props) {
  const counts = useSubjectTabCounts(courseId);
  const items: { tab: SubjectTab; to: string; label: string; count?: number }[] = [
    { tab: "lectures", to: base, label: "Лекции", count: counts.lectures },
    { tab: "pairs", to: `${base}/pairs`, label: "Пары", count: counts.pairs },
    { tab: "exam", to: `${base}/exam`, label: "Экзамен" },
  ];
  return (
    <nav className="c-subject-tabs" aria-label="Раздел предмета">
      {items.map((i) => (
        <NavLink
          key={i.tab}
          to={i.to}
          end
          replace
          aria-current={i.tab === active ? "page" : undefined}
          className={i.tab === active ? "on" : ""}
        >
          {i.label}
          {i.count != null && ` ${i.count}`}
        </NavLink>
      ))}
    </nav>
  );
}
