/**
 * ============================================
 *  HeroSection.tsx — приветствие + факт недели
 * ============================================
 *  Первый блок дашборда (DESIGN.md §7.2): факт без эмодзи и без придуманной
 *  геймификации. Активность теперь живёт в отдельном виджете-календаре
 *  (StudyCalendar) — здесь только текст.
 */

import type { User } from "../../lib/types";
import { userName, pluralRu } from "../../lib/format";

interface Props {
  user: User | null;
  stats?: {
    /** Сколько заметок СОЗДАНО за последние 7 дней. */
    notesThisWeek?: number;
  };
}

export default function HeroSection({ user, stats }: Props) {
  const week = stats?.notesThisWeek ?? 0;
  return (
    <section className="hero-section">
      <div className="hero-main">
        <h1 className="hero-greeting">
          Привет, {userName(user ?? ({} as User))}
        </h1>
        <p className="hero-stats-text">
          {week === 0
            ? "На этой неделе новых заметок пока нет."
            : `${week} ${pluralRu(week, [
                "новая заметка",
                "новые заметки",
                "новых заметок",
              ])} на этой неделе.`}
        </p>
      </div>
    </section>
  );
}
