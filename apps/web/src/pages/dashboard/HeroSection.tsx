/**
 * ============================================
 *  HeroSection.tsx — приветствие + ключевая статистика
 * ============================================
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
      <div>
        <p className="hero-eyebrow">Рабочий стол</p>
        <h1 className="hero-greeting">Привет, {userName(user ?? ({} as User))} 👋</h1>
        <p className="hero-sub">Твои конспекты и заметки — всё в одном месте.</p>
      </div>
      <div className="hero-stat">
        <span className="hero-stat-value">{week}</span>
        <span className="hero-stat-label">
          {week === 1 ? "заметка за неделю" : week >= 2 && week < 5 ? "заметки за неделю" : "заметок за неделю"}
        </span>
      </div>
    </section>
  );
}
