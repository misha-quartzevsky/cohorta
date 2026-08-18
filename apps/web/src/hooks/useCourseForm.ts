/**
 * ============================================
 *  useCourseForm.ts — Course create/edit form state
 * ============================================
 *
 * Centralizes the create/edit course form state that was
 * previously duplicated between Dashboard and CoursesPage:
 * the "new course" fields, the "edit course" fields, and the
 * save/cancel handlers.
 *
 * The presentational render (InlineEditor/AddTile) lives in
 * the sibling CourseFormTile component.
 */

import { useCallback, useState } from "react";
import type { Course } from "../lib/types";
import { courseName, courseColor, courseSemesterId } from "../lib/types";
import { randomCourseColor } from "../lib/colors";

export interface UseCourseFormResult {
  // create mode
  creating: boolean;
  newName: string;
  newColor: string;
  newSemester: string;
  // edit mode
  editingCourse: Course | null;
  editName: string;
  editColor: string;
  editSemester: string;
  // actions
  startCreate: () => void;
  startEdit: (course: Course) => void;
  cancelCreate: () => void;
  cancelEdit: () => void;
  // create field setters
  setNewName: (v: string) => void;
  setNewColor: (v: string) => void;
  setNewSemester: (v: string) => void;
  // edit field setters
  setEditName: (v: string) => void;
  setEditColor: (v: string) => void;
  setEditSemester: (v: string) => void;
  // persistence
  saveNew: () => Promise<void>;
  saveEdited: () => Promise<void>;
}

/**
 * Owns the form state for creating and editing a course.
 *
 * @param createCourse      — mutator from useCourses (create)
 * @param updateCourse      — mutator from useCourses (update)
 * @param defaultSemesterId — semester assigned to new courses by default
 * @returns {UseCourseFormResult} form fields + handlers
 */
export function useCourseForm(
  createCourse: (
    name: string,
    color?: string,
    semesterId?: string
  ) => Promise<void>,
  updateCourse: (
    id: string,
    name: string,
    color?: string,
    semesterId?: string
  ) => Promise<void>,
  defaultSemesterId: string
): UseCourseFormResult {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(() => randomCourseColor());
  const [newSemester, setNewSemester] = useState("");

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSemester, setEditSemester] = useState("");

  const startCreate = useCallback(() => {
    setNewColor(randomCourseColor());
    setNewSemester(defaultSemesterId);
    setCreating(true);
  }, [defaultSemesterId]);

  const startEdit = useCallback((course: Course) => {
    setEditingCourse(course);
    setEditName(courseName(course));
    setEditColor(courseColor(course));
    setEditSemester(courseSemesterId(course));
  }, []);

  const cancelCreate = useCallback(() => {
    setCreating(false);
    setNewName("");
    setNewColor(randomCourseColor());
    setNewSemester("");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCourse(null);
    setEditName("");
    setEditColor("");
    setEditSemester("");
  }, []);

  const saveNew = useCallback(async () => {
    if (!newName.trim()) return;
    await createCourse(
      newName.trim(),
      newColor,
      newSemester || defaultSemesterId
    );
    cancelCreate();
  }, [newName, newColor, newSemester, defaultSemesterId, createCourse, cancelCreate]);

  const saveEdited = useCallback(async () => {
    if (!editingCourse || !editName.trim()) return;
    await updateCourse(
      editingCourse.id,
      editName.trim(),
      editColor,
      editSemester
    );
    cancelEdit();
  }, [editingCourse, editName, editColor, editSemester, updateCourse, cancelEdit]);

  return {
    creating,
    newName,
    newColor,
    newSemester,
    editingCourse,
    editName,
    editColor,
    editSemester,
    startCreate,
    startEdit,
    cancelCreate,
    cancelEdit,
    setNewName,
    setNewColor,
    setNewSemester,
    setEditName,
    setEditColor,
    setEditSemester,
    saveNew,
    saveEdited,
  };
}

export default useCourseForm;
