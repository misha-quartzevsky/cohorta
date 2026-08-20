/**
 * ============================================
 *  ActivityTimeline.tsx — лента последней активности
 * ============================================
 */

import { Link } from "react-router-dom";
import type { TimelineItem } from "../../hooks/useActivityTimeline";
import { pluralRu } from "../../lib/format";

interface Props {
  items: TimelineItem[];
}

export default function ActivityTimeline({ items }: Props) {
  return (
    <div className="widget timeline-widget">
      <h3 className="widget-title">Последняя активность</h3>
      {items.length === 0 ? (
        <p className="widget-empty">Пока нет активности.</p>
      ) : (
        <ul className="timeline-list">
          {items.map((item) => (
            <li key={item.id} className="timeline-item">
              <span className={`timeline-dot ${item.type}`} />
              <div className="timeline-body">
                <Link to={item.to} className="timeline-title">
                  {item.title}
                </Link>
                {item.course && (
                  <span className="timeline-course">{item.course}</span>
                )}
              </div>
              <span className="timeline-time">{item.time}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="timeline-total">
        {items.length} {pluralRu(items.length, ["событие", "события", "событий"])}
      </p>
    </div>
  );
}
