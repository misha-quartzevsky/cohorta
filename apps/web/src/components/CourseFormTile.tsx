/**
 * ============================================
 *  CourseFormTile.tsx — Course form render slots
 * ============================================
 *
 * Renders the inline course create/edit forms shared
 * between Dashboard and CoursesPage.  The form STATE
 * lives in useCourseForm; these presentational slots
 * bind that state to <InlineEditor>/<AddTile> in a
 * single place.
 */

import type { Semester, Course } from "../lib/types";
import type { UseCourseFormResult } from "../hooks/useCourseForm";
import { COURSE_COLORS } from "../lib/colors";
import AddTile from "./AddTile";
import InlineEditor from "./InlineEditor";

interface FormProps {
  form: UseCourseFormResult;
  semesters: Semester[];
}

/**
 * The grid slot for "create a course": either the
 * «+ Добавить курс» tile or the create InlineEditor.
 */
export function CourseCreateSlot({ form, semesters }: FormProps) {
  return form.creating ? (
    <InlineEditor
      value={form.newName}
      onChange={form.setNewName}
      onSave={form.saveNew}
      onCancel={form.cancelCreate}
      placeholder="Название курса (например, «Философия»)"
      color={form.newColor}
      onColorChange={form.setNewColor}
      colors={COURSE_COLORS}
      semesters={semesters}
      semesterValue={form.newSemester}
      onSemesterChange={form.setNewSemester}
    />
  ) : (
    <AddTile label="+ Добавить курс" onClick={form.startCreate} />
  );
}

interface EditSlotProps extends FormProps {
  course: Course;
  /** Rendered when `course` is not the one currently being edited. */
  fallback: React.ReactNode;
}

/**
 * The grid slot for a single course: either the edit
 * InlineEditor (when this course is being edited) or
 * the provided `fallback` tile.
 */
export function CourseEditSlot({
  course,
  form,
  semesters,
  fallback,
}: EditSlotProps) {
  if (form.editingCourse?.id !== course.id) return <>{fallback}</>;

  return (
    <InlineEditor
      value={form.editName}
      onChange={form.setEditName}
      onSave={form.saveEdited}
      onCancel={form.cancelEdit}
      placeholder="Название курса"
      color={form.editColor}
      onColorChange={form.setEditColor}
      colors={COURSE_COLORS}
      semesters={semesters}
      semesterValue={form.editSemester}
      onSemesterChange={form.setEditSemester}
    />
  );
}
