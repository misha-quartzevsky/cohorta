/**
 * TagBadges.tsx — coloured tag chips for a lecture (read-only).
 */

import { useEffect, useState } from "react";
import type { Tag } from "../lib/types";
import { tagColor, tagLectureIds, tagName } from "../lib/types";
import { fetchTags } from "../services/tagService";

interface Props {
  lectureId: string;
}

export default function TagBadges({ lectureId }: Props) {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchTags()
      .then((all) => {
        if (!cancelled) {
          setTags(all.filter((t) => tagLectureIds(t).includes(lectureId)));
        }
      })
      .catch((e) => {
        console.error("Ошибка загрузки тегов:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [lectureId]);

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="tag-badges">
      {tags.map((t) => {
        const color = tagColor(t) || "#5843f6";
        return (
          <span
            key={t.id}
            className="tag-badge"
            style={{
              background: `${color}2e`,
              borderColor: `${color}66`,
            }}
          >
            <span className="tag-dot" style={{ background: color }} />
            {tagName(t)}
          </span>
        );
      })}
    </div>
  );
}
