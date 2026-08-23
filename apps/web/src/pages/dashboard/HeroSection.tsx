/**
 * ============================================
 *  HeroSection.tsx — приветствие + факт недели + пульс активности
 * ============================================
 *  Первый блок дашборда (DESIGN.md §7.2): факт без эмодзи и без придуманной
 *  геймификации. Тепловая карта стоит справа от приветствия — компактный
 *  пульс, а не отдельный виджет.
 */

import type { User } from "../../lib/types";
import { userName, pluralRu } from "../../lib/format";
import ActivityHeatmap from "./ActivityHeatmap";

interface Props {
  user: User | null;
  stats?: {
    /** Сколько заметок СОЗДАНО за последние 7 дней. */
    notesThisWeek?: number;
  };
  /** Карта «день → число действий» для пульса активности. */
  activity?: Map<string, number>;
}

export default function HeroSection({ user, stats, activity }: Props) {
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
      {activity && activity.size > 0 && (
        <div className="hero-heatmap">
          <ActivityHeatmap days={activity} />
        </div>
      )}
    </section>
  );
}
