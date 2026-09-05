import { useNavigate } from "react-router-dom";

import { useCourses } from "../hooks/useCourses";
import { useDecks } from "../hooks/useDecks";
import { useCourseForm } from "../hooks/useCourseForm";
import { useAuth } from "../hooks/useAuth";
import { useLastVisited } from "../hooks/useLastVisited";
import { useActivityTimeline } from "../hooks/useActivityTimeline";
import { useSemester } from "../lib/semesterContext";
import { semesterSlug, examCourseId } from "../lib/types";
import { useActivityHeatmap } from "../hooks/useActivityHeatmap";
import { useUpcomingExam, useExam } from "../hooks/useExam";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";
import { CourseCreateSlot } from "../components/CourseFormTile";

import HeroSection from "./dashboard/HeroSection";
import QuickActionsBar from "./dashboard/QuickActionsBar";
import PriorityHero from "./dashboard/PriorityHero";
import CoursesWidget from "./dashboard/CoursesWidget";
import StudyWeekStrip from "./dashboard/StudyWeekStrip";
import ActivityTimeline from "./dashboard/ActivityTimeline";
import ReviewBlock from "./dashboard/ReviewBlock";

/**
 * Дашборд — Design Sprint, Концепция A (Wednesday Decide, DESIGN.md §7.2
 * обновлён по её итогам). Один явный герой вместо двух конкурирующих блоков
 * («Продолжить» и «Ближайший экзамен» раньше рендерились отдельно):
 * приветствие → PriorityHero (экзамен скоро ИЛИ продолжить ИЛИ пусто) →
 * быстрые действия → курсы семестра | эта неделя → колоды | активность.
 * Полный календарь месяца свёрнут в полоску текущей недели — та же
 * честная активность, без пустой сетки на треть экрана.
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
    loading: coursesLoading,
    error: coursesError,
    createCourse,
    updateCourse,
  } = useCourses(semesterId);

  const { decks } = useDecks(4);
  const { exam: upcomingExam } = useUpcomingExam();
  const { tickets: upcomingTickets } = useExam(
    upcomingExam ? examCourseId(upcomingExam) : "",
    !!upcomingExam
  );

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
            />

            {form.creating && (
              <div className="dashboard-create-slot">
                <CourseCreateSlot form={form} semesters={semesters} />
              </div>
            )}

            <PriorityHero
              exam={upcomingExam}
              tickets={upcomingTickets}
              semesterSlug={semSlug}
              lastVisited={lastVisited}
            />

            <QuickActionsBar
              onNewNote={() => navigate("/note/new")}
              onNewCourse={form.startCreate}
              onNewDeck={() => navigate("/decks/new")}
            />

            <div className="dashboard-grid">
              <CoursesWidget
                courses={courses.slice(0, 6)}
                semesterSlug={semSlug}
                total={courses.length}
              />
              <StudyWeekStrip
                days={heatmap.days}
                dayLectures={heatmap.dayLectures}
                dayDeckCount={heatmap.dayDeckCount}
                semesterSlug={semSlug}
              />
            </div>

            <div className="dashboard-grid">
              <ReviewBlock decks={decks} />
              <ActivityTimeline items={timeline} />
            </div>
          </div>
        </>
      )}
    </SemesterGate>
  );
}

export default Dashboard;
