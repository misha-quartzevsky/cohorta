/**
 * ============================================
 *  ResumeBlock.tsx — «Продолжить» (последняя лекция)
 * ============================================
 */

import { Link } from "react-router-dom";
import { Play, ArrowRight } from "lucide-react";
import type { LastVisitedEntry } from "../../lib/lastVisited";
import { timeAgo } from "../../lib/format";

interface Props {
  lastVisited: LastVisitedEntry | null;
}

export default function ResumeBlock({ lastVisited }: Props) {
  if (!lastVisited) return null;
  return (
    <section className="resume-block">
      <div className="resume-icon">
        <Play size={18} />
      </div>
      <div className="resume-info">
        <span className="resume-label">Продолжить</span>
        <Link to={lastVisited.to} className="resume-title">
          {lastVisited.title}
        </Link>
        {lastVisited.courseName && (
          <span className="resume-meta">
            · {lastVisited.courseName} · {timeAgo(lastVisited.savedAt)}
          </span>
        )}
      </div>
      <Link to={lastVisited.to} className="resume-cta" aria-label="Открыть">
        <ArrowRight size={18} />
      </Link>
    </section>
  );
}
