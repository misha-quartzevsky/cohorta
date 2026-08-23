/**
 * ============================================
 *  ResumeBlock.tsx — «Продолжить» (последняя открытая запись)
 * ============================================
 *  Hero-блок дашборда (DESIGN.md §7.2): самое частое действие видно первым.
 *  Прогресс-бара здесь нет — прогресс чтения нигде не хранится, а рисовать
 *  выдуманный процент в главном блоке продукта нельзя.
 *  Пустое состояние — приглашение к действию (§8), а не исчезающий блок.
 */

import { Link } from "react-router-dom";
import { Play, Plus } from "lucide-react";
import type { LastVisitedEntry } from "../../lib/lastVisited";

interface Props {
  lastVisited: LastVisitedEntry | null;
}

export default function ResumeBlock({ lastVisited }: Props) {
  if (!lastVisited) {
    return (
      <section className="resume-block resume-empty">
        <div className="resume-icon">
          <Plus size={20} />
        </div>
        <div className="resume-info">
          <span className="resume-label">С чего начнём</span>
          <span className="resume-title">
            Создай первую заметку — она откроется здесь одним кликом
          </span>
        </div>
        <Link to="/note/new" className="resume-cta">
          <Plus size={14} />
          Новая заметка
        </Link>
      </section>
    );
  }

  return (
    <section className="resume-block">
      <div className="resume-icon">
        <Play size={20} />
      </div>
      <div className="resume-info">
        <span className="resume-label">
          Продолжить
          {lastVisited.courseName ? ` · ${lastVisited.courseName}` : ""}
        </span>
        <Link to={lastVisited.to} className="resume-title">
          {lastVisited.title}
        </Link>
      </div>
      <Link to={lastVisited.to} className="resume-cta" aria-label="Открыть">
        <Play size={14} />
        Открыть
      </Link>
    </section>
  );
}
