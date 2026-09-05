/**
 * ============================================
 *  App.tsx — Application Entry Point
 * ============================================
 *
 * Sets up client-side routing with React Router.
 * Every route is scoped to a semester:
 *
 *   /                                          → redirect to last/first semester
 *   /s/:semesterSlug                           → semester dashboard
 *   /s/:semesterSlug/courses                   → all courses of the semester
 *   /s/:semesterSlug/:courseSlug               → lectures of a course
 *   /s/:semesterSlug/:courseSlug/:lectureSlug  → lecture (inline edit on click)
 *   /s/:semesterSlug/:courseSlug/:lectureSlug/edit → same surface, editor open
 *   /note/:lectureSlug(+/edit)                 → unassigned notes (no semester)
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import CoursesPage from "./pages/CoursesPage";
import LecturesPage from "./pages/LecturesPage";
import LectureView from "./pages/LectureView";
import NotesPage from "./pages/NotesPage";
import NoteCreate from "./pages/NoteCreate";
import CardLibraryPage from "./pages/CardLibraryPage";
import CardStudyPage from "./pages/CardStudyPage";
import DeckEditorPage from "./pages/DeckEditorPage";
import ExamsPage from "./pages/ExamsPage";
import GroupPage from "./pages/GroupPage";
import ExamHubPage from "./pages/ExamHubPage";
import ExamImportPage from "./pages/ExamImportPage";
import TicketView from "./pages/TicketView";
import TicketEdit from "./pages/TicketEdit";
import CheatsheetPage from "./pages/CheatsheetPage";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingState from "./components/LoadingState";
import Login from "./pages/Login";
import PrivacyPage from "./pages/PrivacyPage";
import LectureLayout from "./components/LectureLayout";
import AppLayout from "./components/AppLayout";
import { SemesterProvider } from "./lib/SemesterProvider";
import { SpeechProvider } from "./lib/SpeechProvider";
import { ModeProvider } from "./lib/ModeProvider";
import { UndoProvider } from "./lib/undoContext";
import {
  useSemester,
  LAST_SEMESTER_KEY,
} from "./lib/semesterContext";
import { semesterSlug } from "./lib/types";
import "./App.css";

/**
 * Redirects "/" to the last visited semester
 * (or the first one when there is no history).
 * Shows a hint when no semesters exist yet.
 */
function HomeRedirect() {
  const { semesters, loading } = useSemester();

  if (loading) return <LoadingState />;

  if (semesters.length === 0) {
    return (
      <>
        <Header crumbs={[{ label: "Рабочий стол" }]} />
        <div className="page">
          <div className="empty">
            Нет семестров. Создайте их в админке PocketBase.
          </div>
        </div>
      </>
    );
  }

  const last = localStorage.getItem(LAST_SEMESTER_KEY);
  const target = semesters.some((s) => semesterSlug(s) === last)
    ? (last as string)
    : semesterSlug(semesters[0]);
  return <Navigate to={`/s/${target}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <ModeProvider>
      <UndoProvider>
      <SpeechProvider>
        <SemesterProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/s/:semesterSlug" element={<Dashboard />} />
              <Route path="/s/:semesterSlug/courses" element={<CoursesPage />} />
              {/* Сводка по всем экзаменам семестра — статический сегмент
                  "exams" (RESERVED_SLUGS), встаёт до :courseSlug ниже. */}
              <Route path="/s/:semesterSlug/exams" element={<ExamsPage />} />
              {/* Экран «Моя группа» — статический сегмент "group"
                  (RESERVED_SLUGS), тоже до :courseSlug. */}
              <Route path="/s/:semesterSlug/group" element={<GroupPage />} />
              <Route path="/s/:semesterSlug/:courseSlug" element={<LecturesPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/note/new" element={<NoteCreate />} />
              {/* Lecture view + edit are ONE surface (Notion-style inline
                  editing): LectureView shows the record and mounts the editor
                  in place on first click. `/…/edit` stays as an alias that
                  simply opens straight in editor mode (external links, muscle
                  memory, tests). The header + course sidebar live in
                  LectureLayout and stay mounted while switching lectures. */}
              <Route element={<LectureLayout />}>
                <Route
                  path="/s/:semesterSlug/:courseSlug/:lectureSlug"
                  element={<LectureView />}
                />
                <Route
                  path="/s/:semesterSlug/:courseSlug/:lectureSlug/edit"
                  element={<LectureView />}
                />
                {/* Unassigned notes (no semester in URL) */}
                <Route
                  path="/note/:lectureSlug"
                  element={<LectureView />}
                />
                <Route
                  path="/note/:lectureSlug/edit"
                  element={<LectureView />}
                />
              </Route>
              {/* Exam Engine: экзамен — свойство курса, singleton внутри него.
                  Статический сегмент "exam" ранжируется React Router выше
                  динамического :lectureSlug на этом же месте, поэтому лекция
                  со слагом "exam" туда не попадёт (см. RESERVED_SLUGS). */}
              <Route
                path="/s/:semesterSlug/:courseSlug/exam"
                element={<ExamHubPage />}
              />
              <Route
                path="/s/:semesterSlug/:courseSlug/exam/import"
                element={<ExamImportPage />}
              />
              <Route
                path="/s/:semesterSlug/:courseSlug/exam/cheatsheet"
                element={<CheatsheetPage />}
              />
              <Route
                path="/s/:semesterSlug/:courseSlug/exam/:number"
                element={<TicketView />}
              />
              <Route
                path="/s/:semesterSlug/:courseSlug/exam/:number/edit"
                element={<TicketEdit />}
              />
              {/* Flashcards: cards module (not semester-scoped) */}
              <Route path="/decks" element={<CardLibraryPage />} />
              <Route path="/decks/new" element={<DeckEditorPage />} />
              <Route path="/decks/:slug" element={<CardStudyPage />} />
              <Route path="/decks/:slug/edit" element={<DeckEditorPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SemesterProvider>
      </SpeechProvider>
      </UndoProvider>
      </ModeProvider>
    </BrowserRouter>
  );
}

export default App;
