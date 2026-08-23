import { useNavigate } from "react-router-dom";

import { useCourses } from "../hooks/useCourses";
import { useDecks } from "../hooks/useDecks";
import { useCourseForm } from "../hooks/useCourseForm";
import { useAuth } from "../hooks/useAuth";
import { useLastVisited } from "../hooks/useLastVisited";
import { useActivityTimeline } from "../hooks/useActivityTimeline";
import { useSemester } from "../lib/semesterContext";
import { semesterSlug } from "../lib/types";
import { useActivityHeatmap } from "../hooks/useActivityHeatmap";

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
import ReviewBlock from "./dashboard/ReviewBlock";

/**
 * Дашборд по DESIGN.md §7.2, порядок блоков по частоте использования:
 * приветствие (+ пульс активности) → «Продолжить» → быстрые действия →
 * курсы семестра | (колоды + последняя активность).
 * Редактирование курсов/лекций намеренно живёт на своих страницах.
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

  const { decks } = useDecks(4);

  const lastVisited = useLastVisited();
  const timeline = useActivityTimeline(10);
  const heatmap = useActivityHeatmap();

  const form = useCourseForm(createCourse, updateCourse, semesterId);

  const loading = coursesLoading && courses.length === 0;
  const error = semError || coursesError;

  return (
    <SemesterGate>
      {loading ? (
        <LoadingState />
      ) : (
        <>
          <Header crumbs={[{ label: "Рабочий стол" }]} />
          <div className="page dashboard-page">
            <ErrorBanner message={error} />

            <HeroSection
              user={user}
              stats={{ notesThisWeek: heatmap.notesThisWeek }}
              activity={heatmap.days}
            />



            {form.creating && (
              <div className="dashboard-create-slot">
                <CourseCreateSlot form={form} semesters={semesters} />
              </div>
            )}



            <ResumeBlock lastVisited={lastVisited} />

            <QuickActionsBar
              onNewNote={() => navigate("/note/new")}
              onNewCourse={form.startCreate}
              onNewDeck={() => navigate("/decks/new")}
            />

            <div className="dashboard-grid">
              <div className="col-main">
                <CoursesWidget
                  courses={courses.slice(0, 4)}
                  featured={featured}
                  semesterSlug={semSlug}
                  total={courses.length}
                />
              </div>
              <div className="col-side">
                <ReviewBlock decks={decks} />
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
