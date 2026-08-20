/**
 * ============================================
 *  HeroSection.tsx — приветствие + статистика
 * ============================================
 *  Статистика (заметки за неделю) встроена в левую колонку приветствия
 *  напрямую (блок .hero-stats-inline) — отдельный выносной блок убран.
 */

import type { User } from "../../lib/types";
import { userName } from "../../lib/format";

interface Props {
  user: User | null;
  stats?: {
    lecturesThisWeek?: number;
  };
}

export default function HeroSection({ user, stats }: Props) {
  const week = stats?.lecturesThisWeek ?? 0;
  return (
    <section className="hero-section">
      <div className="hero-main">
        <p className="hero-eyebrow">Рабочий стол</p>
        <h1 className="hero-greeting">Привет, {userName(user ?? ({} as User))} 👋</h1>
        <p className="hero-sub">Твои конспекты и заметки — всё в одном месте.</p>

        {/* Статистика внутри приветствия — больше не отдельный блок справа. */}
        <div className="hero-stats-inline">
          <div className="hero-stat-item">
            <span className="hero-stat-value">{week}</span>
            <span className="hero-stat-label">
              {week === 1
                ? "заметка"
                : week >= 2 && week < 5
                  ? "заметки"
                  : "заметок"}{" "}
              за неделю
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
