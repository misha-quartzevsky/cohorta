/**
 * ============================================
 *  App.tsx — Application Entry Point
 * ============================================
 *
 * Sets up client-side routing with React Router:
 *
 *   /                   → Dashboard (recent courses + recent files)
 *   /courses            → CoursesPage (all courses)
 *   /courses/:courseId  → LecturesPage (lectures of one course)
 */

import { BrowserRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import CoursesPage from "./pages/CoursesPage";
import LecturesPage from "./pages/LecturesPage";
import LectureView from "./pages/LectureView";
import LectureEdit from "./pages/LectureEdit";
import "./App.css";

/** Wrapper that routes a course click to its lectures page. */
function CoursesRoute() {
  const navigate = useNavigate();
  return (
    <CoursesPage
      onOpen={(courseId) => navigate(`/courses/${courseId}`)}
    />
  );
}

/** Wrapper that injects the courseId from the URL and handles "back". */
function LecturesRoute() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  return (
    <LecturesPage
      courseId={courseId ?? ""}
      onBack={() => navigate("/")}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/courses" element={<CoursesRoute />} />
        <Route path="/courses/:courseId" element={<LecturesRoute />} />
        <Route path="/lectures/:lectureId" element={<LectureView />} />
        <Route path="/lectures/:lectureId/edit" element={<LectureEdit />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;