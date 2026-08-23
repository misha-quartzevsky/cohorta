/**
 * ============================================
 *  ActivityHeatmap.tsx — компактная тепловая карта активности
 * ============================================
 *
 * GitHub-style grid of tiny squares (10×10, radius 2px) rendered on pure CSS
 * Grid (grid-auto-flow: column, 7 rows = one week column). Each cell shows
 * the activity level for a single day over the last ~3 months.
 *
 * No libraries, no borders — the squares "float" on the background. The
 * lilac palette scales from an almost-invisible 0 to a saturated 5+.
 */

import { useMemo } from "react";
import { pluralRu } from "../../lib/format";
import {
  heatmapDayKey,
  HEATMAP_DAYS,
} from "../../hooks/useActivityHeatmap";

interface Props {
  /** day key ("YYYY-MM-DD") → number of actions that day. */
  days: Map<string, number>;
}

/** Map a day's action count to a CSS level class (heat-0 … heat-3). */
function level(count: number): number {
  if (count >= 5) return 3;
  if (count >= 3) return 2;
  if (count >= 1) return 1;
  return 0;
}

export default function ActivityHeatmap({ days }: Props) {
  // Build a contiguous grid of the last HEATMAP_DAYS ending today.
  const cells = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (HEATMAP_DAYS - 1));

    const out: { key: string; label: string; count: number; level: number }[] =
      [];
    for (let i = 0; i < HEATMAP_DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = heatmapDayKey(d);
      const count = days.get(key) ?? 0;
      const label = d.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
      });
      out.push({ key, label, count, level: level(count) });
    }
    return out;
  }, [days]);

  return (
    <div className="heatmap" aria-label="Активность за последние 3 месяца">
      <div className="heatmap-grid">
        {cells.map((cell) => {
          const tip = `${cell.label}: ${cell.count} ${pluralRu(cell.count, [
            "действие",
            "действия",
            "действий",
          ])}`;
          return (
            <div
              key={cell.key}
              className={`heat-cell heat-${cell.level}`}
              data-label={tip}
              role="img"
              title={tip}
            />
          );
        })}
      </div>
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Меньше</span>
        <span className="heat-legend-cell heat-0" />
        <span className="heat-legend-cell heat-1" />
        <span className="heat-legend-cell heat-2" />
        <span className="heat-legend-cell heat-3" />
        <span className="heatmap-legend-label">Больше</span>
      </div>
    </div>
  );
}
