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
 *   /s/:semesterSlug/:courseSlug/:lectureSlug  → lecture view
 *   /s/:semesterSlug/:courseSlug/:lectureSlug/edit → lecture edit
 *   /s/:semesterSlug/note/:lectureSlug(+/edit) → unassigned notes
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import CoursesPage from "./pages/CoursesPage";
import LecturesPage from "./pages/LecturesPage";
import LectureView from "./pages/LectureView";
import LectureEdit from "./pages/LectureEdit";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingState from "./components/LoadingState";
import Login from "./pages/Login";
import LectureLayout from "./components/LectureLayout";
import { SemesterProvider } from "./lib/SemesterProvider";
import { SpeechProvider } from "./lib/SpeechProvider";
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
      <SpeechProvider>
        <SemesterProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/s/:semesterSlug" element={<Dashboard />} />
            <Route path="/s/:semesterSlug/courses" element={<CoursesPage />} />
            <Route path="/s/:semesterSlug/:courseSlug" element={<LecturesPage />} />
            {/* Lecture view/edit share one persistent frame: the header and
                course sidebar live in LectureLayout and stay mounted while the
                user switches between lectures (no full-screen flicker). */}
            <Route element={<LectureLayout />}>
              <Route
                path="/s/:semesterSlug/:courseSlug/:lectureSlug"
                element={<LectureView />}
              />
              <Route
                path="/s/:semesterSlug/:courseSlug/:lectureSlug/edit"
                element={<LectureEdit />}
              />
              <Route
                path="/s/:semesterSlug/note/:lectureSlug"
                element={<LectureView />}
              />
              <Route
                path="/s/:semesterSlug/note/:lectureSlug/edit"
                element={<LectureEdit />}
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SemesterProvider>
      </SpeechProvider>
    </BrowserRouter>
  );
}

export default App;
