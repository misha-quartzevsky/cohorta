import { useNavigate } from "react-router-dom";

import { useCourses } from "../hooks/useCourses";
import { useRecentLectures } from "../hooks/useRecentLectures";
import { useCourseForm } from "../hooks/useCourseForm";
import { useAuth } from "../hooks/useAuth";
import { useLastVisited } from "../hooks/useLastVisited";
import { useActivityTimeline } from "../hooks/useActivityTimeline";
import { useSemester } from "../lib/semesterContext";
import { semesterSlug } from "../lib/types";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";
import { CourseCreateSlot } from "../components/CourseFormTile";

import HeroSection from "./dashboard/HeroSection";
import QuickActionsBar from "./dashboard/QuickActionsBar";
import ResumeBlock from "./dashboard/ResumeBlock";
import CoursesWidget from "./dashboard/CoursesWidget";
import ActivityTimeline from "./dashboard/ActivityTimeline";

/**
 * Dashboard 2.0 — приветственный экран семестра:
 * Hero + быстрые действия + «Продолжить» + курсы семестра + лента активности.
 *
 * Редактирование/удаление курсов и записей с дашборда намеренно убраны
 * (чистота интерфейса) — эти действия живут на специализированных страницах.
 */
function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, semesters, error: semError } = useSemester();
  const semesterId = current?.id ?? "";
  const semSlug = current ? semesterSlug(current) : "";

  const {
    courses,
    featured,
    loading: coursesLoading,
    error: coursesError,
    createCourse,
    updateCourse,
  } = useCourses(semesterId);

  const {
    lectures,
    loading: lecturesLoading,
    error: lecturesError,
  } = useRecentLectures(30);

  const lastVisited = useLastVisited();
  const timeline = useActivityTimeline(10);

  // Форма создания курса (быстрые действия → CourseCreateSlot).
  const form = useCourseForm(createCourse, updateCourse, semesterId);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const lecturesThisWeek = lectures.filter(
    (l) => new Date(l.updated).getTime() >= weekAgo
  ).length;

  const loading =
    (coursesLoading && courses.length === 0) ||
    (lecturesLoading && lectures.length === 0);
  const error = semError || coursesError || lecturesError;

  return (
    <SemesterGate>
      {loading ? (
        <LoadingState />
      ) : (
        <>
          <Header crumbs={[{ label: "Рабочий стол" }]} />
          <div className="page">
            <div className="content-canvas dashboard-canvas">
              <ErrorBanner message={error} />

              <HeroSection user={user} stats={{ lecturesThisWeek }} />

              <QuickActionsBar
                onNewNote={() => navigate("/note/new")}
                onNewCourse={form.startCreate}
                onNewDeck={() => navigate("/decks/new")}
              />

              {form.creating && (
                <div className="dashboard-create-slot">
                  <CourseCreateSlot form={form} semesters={semesters} />
                </div>
              )}

              <ResumeBlock lastVisited={lastVisited} />

              <div className="dashboard-bento">
                <CoursesWidget
                  courses={courses.slice(0, 4)}
                  featured={featured}
                  semesterSlug={semSlug}
                />
                <ActivityTimeline items={timeline} />
              </div>
            </div>
          </div>
        </>
      )}
    </SemesterGate>
  );
}

export default Dashboard;