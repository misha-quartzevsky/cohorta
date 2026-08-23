/**
 * ============================================
 *  ActivityTimeline.tsx — компактная лента активности
 * ============================================
 *  DESIGN.md §7.6: активность вторична и компактна — только список событий.
 *  Тепловая карта живёт в приветствии (HeroSection), чтобы не дублировать
 *  один и тот же факт двумя способами в одном виджете.
 */

import { Link } from "react-router-dom";
import type { TimelineItem } from "../../hooks/useActivityTimeline";

interface Props {
  items: TimelineItem[];
}

export default function ActivityTimeline({ items }: Props) {
  return (
    <div className="widget timeline-widget">
      <div className="widget-head">
        <h3 className="widget-title">Последняя активность</h3>
      </div>
      {items.length === 0 ? (
        <p className="widget-empty">Открой любую заметку — она появится здесь.</p>
      ) : (
        <ul className="timeline-list">
          {items.map((item) => (
            <li key={item.id} className="timeline-item">
              <span className={"timeline-dot " + item.type} />
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
    </div>
  );
}
