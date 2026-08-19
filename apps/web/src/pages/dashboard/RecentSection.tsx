/**
 * ============================================
 *  pages/dashboard/RecentSection.tsx — «Последние»
 * ============================================
 *
 * Presentational section of the dashboard showing recent lectures
 * (unassigned notes + lectures of the current semester's courses) plus
 * the «new note» slot. All data and handlers come from the parent page
 * through props.
 */

import type { Course, Lecture } from "../../lib/types";
import {
  courseName,
  courseColor,
  lectureCourseId,
} from "../../lib/types";
import AddTile from "../../components/AddTile";
import LectureTile from "../../components/LectureTile";

interface Props {
  lectures: Lecture[];
  courses: Course[];
  onCreateNote: () => void;
  onOpenLecture: (lec: Lecture) => void;
  onEditLecture: (lec: Lecture) => void;
  onDeleteLecture: (lec: Lecture) => void;
  onAssignCourse: (lec: Lecture, courseId: string) => void;
}

export default function RecentSection({
  lectures,
  courses,
  onCreateNote,
  onOpenLecture,
  onEditLecture,
  onDeleteLecture,
  onAssignCourse,
}: Props) {
  return (
    <section className="dashboard-section">
      <h2 className="section-title">Последние</h2>

      <div className="bento">
        <AddTile label="+ Новая заметка" onClick={onCreateNote} />

        {lectures.map((lec, i) => {
          const idx = i + 1;
          const unassigned = !lectureCourseId(lec);
          const lecCourse = unassigned
            ? undefined
            : courses.find((c) => c.id === lectureCourseId(lec));

          return (
            <LectureTile
              key={`lec-${lec.id}`}
              lecture={lec}
              index={idx}
              unassigned={unassigned}
              courses={unassigned ? courses : undefined}
              onAssignCourse={onAssignCourse}
              courseTag={lecCourse ? courseName(lecCourse) : undefined}
              courseColorTag={
                lecCourse ? courseColor(lecCourse) : undefined
              }
              onClick={() => onOpenLecture(lec)}
              onEdit={() => onEditLecture(lec)}
              onDelete={onDeleteLecture}
            />
          );
        })}
      </div>
    </section>
  );
}
