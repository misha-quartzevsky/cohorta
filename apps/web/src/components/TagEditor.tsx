/**
 * TagEditor.tsx — tag chips for the edit page.
 *
 * Click a chip to toggle it. New tags can be created inline.
 */

import { useEffect, useState } from "react";
import type { Tag } from "../lib/types";
import { tagColor, tagName } from "../lib/types";
import { createTag, fetchTags } from "../services/tagService";

const NEW_TAG_COLORS = [
  "#9C8FE2",
  "#FE4E1C",
  "#5ACF65",
  "#5199FC",
  "#FFD13A",
  "#FF8FB1",
];

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function TagEditor({ selectedIds, onChange }: Props) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTags()
      .then((list) => {
        if (!cancelled) {
          setAllTags(list);
        }
      })
      .catch((e) => {
        console.error("Ошибка загрузки тегов:", e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((existing) => existing !== id)
        : [...selectedIds, id]
    );
  };

  const addNew = async () => {
    const name = newName.trim();
    if (!name || busy) {
      return;
    }
    setBusy(true);
    try {
      const color = NEW_TAG_COLORS[allTags.length % NEW_TAG_COLORS.length];
      const tag = await createTag(name, color);
      setAllTags((prev) => [...prev, tag]);
      onChange([...selectedIds, tag.id]);
      setNewName("");
    } catch (e) {
      console.error("Ошибка создания тега:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tag-editor">
      {allTags.map((t) => {
        const active = selectedIds.includes(t.id);
        const color = tagColor(t) || "#5843f6";
        return (
          <button
            key={t.id}
            type="button"
            className={`tag-chip${active ? " active" : ""}`}
            style={
              active
                ? {
                    background: `${color}33`,
                    borderColor: color,
                    color: "#1b1b1b",
                  }
                : undefined
            }
            onClick={() => toggle(t.id)}
          >
            <span className="tag-dot" style={{ background: color }} />
            {tagName(t)}
          </button>
        );
      })}
      <div className="tag-editor-new">
        <input
          className="tag-input"
          placeholder="Новый тег…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addNew();
            }
          }}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={() => void addNew()}
          disabled={!newName.trim() || busy}
        >
          Добавить
        </button>
      </div>
    </div>
  );
}
