/**
 * LectureSidebar.tsx — left glass column with the course lecture list.
 */

import { ArrowLeft } from "lucide-react";
import type { Lecture } from "../lib/types";
import { lectureSlug, lectureTitle } from "../lib/types";

interface Props {
  courseName: string;
  lectures: Lecture[];
  activeSlug: string;
  onSelect: (slug: string) => void;
  onBack: () => void;
}

export default function LectureSidebar({
  courseName,
  lectures,
  activeSlug,
  onSelect,
  onBack,
}: Props) {
  return (
    <aside className="workspace-sidebar">
      <button type="button" className="sidebar-back" onClick={onBack}>
        <ArrowLeft size={13} />
        Все лекции
      </button>
      <p className="workspace-sidebar-title">{courseName}</p>
      <ul className="lecture-list">
        {lectures.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              className={`lecture-side-item${
                lectureSlug(l) === activeSlug ? " active" : ""
              }`}
              onClick={() => onSelect(lectureSlug(l))}
              title={lectureTitle(l)}
            >
              {lectureTitle(l)}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
