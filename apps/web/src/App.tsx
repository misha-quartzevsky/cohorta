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
import LecturesAllPage from "./pages/LecturesAllPage";
import SubjectLecturesPage from "./pages/SubjectLecturesPage";
import DraftsPage from "./pages/DraftsPage";
import LectureView from "./pages/LectureView";
import NotesPage from "./pages/NotesPage";
import NewDraftRedirect from "./pages/NewDraftRedirect";
import DeckEditorPage from "./pages/DeckEditorPage";
import ExamsPage from "./pages/ExamsPage";
import ExamHubPage from "./pages/ExamHubPage";
import ExamImportPage from "./pages/ExamImportPage";
import TicketPage from "./pages/TicketPage";
import CheatsheetPage from "./pages/CheatsheetPage";
import ProtectedRoute from "./components/ProtectedRoute";
import MorePage from "./pages/MorePage";
import CardsPage from "./pages/CardsPage";
import DeckPage from "./pages/DeckPage";
import CardReviewPage from "./pages/CardReviewPage";
import ProfilePage from "./pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";
import SettingsPage from "./pages/SettingsPage";
import SettingsPeriodsPage from "./pages/SettingsPeriodsPage";
import TrashPage from "./pages/TrashPage";
import LoadingState from "./components/LoadingState";
import ErrorBanner from "./components/ErrorBanner";
import Header from "./components/Header";
import { useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/auth/LoginPage";
import PolicyPage from "./pages/auth/PolicyPage";
import { ResetEntryPage, ResetNewPasswordPage } from "./pages/auth/ResetPages";
import { JoinRoute } from "./pages/auth/JoinGroupPage";
import {
  GroupHomeRoute,
  GroupAccessRoute,
  GroupSettingsRoute,
  GroupMemberRoute,
  GroupMemberSubjectRoute,
  GroupJoinRoute,
  GroupLectureRoute,
  GroupExamsRoute,
  GroupExamRoute,
  GroupExamImportRoute,
  GroupTicketRoute,
  GroupCreatePage,
} from "./pages/group/GroupRoutes";
import Onboarding from "./features/onboarding/Onboarding";
import LectureLayout from "./components/LectureLayout";
import AppLayout from "./components/AppLayout";
import { SemesterProvider } from "./lib/SemesterProvider";
import { SpeechProvider } from "./lib/SpeechProvider";
import { ModeProvider } from "./lib/ModeProvider";
import { UndoProvider } from "./lib/undoContext";
import { ToastProvider } from "./ui";
import SchedulePage from "./pages/SchedulePage";
import TasksPage from "./pages/TasksPage";
import SubjectPairsPage from "./pages/SubjectPairsPage";
import QuizPage from "./pages/QuizPage";
import {
  useSemester,
  LAST_SEMESTER_KEY,
} from "./lib/semesterContext";
import { semesterSlug } from "./lib/types";
import { LAND_IN_GROUP_KEY } from "./pages/auth/JoinGroupPage";

/**
 * Redirects "/" to the last visited semester
 * (or the first one when there is no history).
 * Shows a hint when no semesters exist yet.
 */
function HomeRedirect() {
  const { semesters, loading, error, refetch } = useSemester();
  const { user } = useAuth();

  if (loading) return <LoadingState />;

  if (semesters.length === 0) {
    // Онбординг не пройден → в мастер.
    if (user && user.onboarding_completed !== true) {
      return <Navigate to="/onboarding" replace />;
    }
    // Онбординг пройден, но периодов нет: сбой загрузки или все удалены.
    // НЕ уводим в /onboarding (его гейт вернёт сюда → бесконечный цикл) —
    // показываем состояние с повтором.
    return (
      <>
        <Header crumbs={[{ label: "Рабочий стол" }]} />
        <div className="page">
          {error ? (
            <ErrorBanner message="Не удалось загрузить учебные периоды. Проверьте соединение." />
          ) : (
            <div className="empty">У вас пока нет учебных периодов.</div>
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: "1rem" }}
            onClick={() => void refetch()}
          >
            Обновить
          </button>
        </div>
      </>
    );
  }

  const last = localStorage.getItem(LAST_SEMESTER_KEY);
  const target = semesters.some((s) => semesterSlug(s) === last)
    ? (last as string)
    : semesterSlug(semesters[0]);
  // Вступил в группу по ссылке до онбординга: после него показываем группу,
  // чтобы человек понял, где он (решение 19.10, «Группа»).
  try {
    if (localStorage.getItem(LAND_IN_GROUP_KEY) === "1") {
      localStorage.removeItem(LAND_IN_GROUP_KEY);
      return <Navigate to={`/s/${target}/group`} replace />;
    }
  } catch {
    /* хранилище недоступно */
  }
  return <Navigate to={`/s/${target}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <ModeProvider>
      <UndoProvider>
      <SpeechProvider>
        <SemesterProvider>
        <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage mode="login" />} />
          <Route path="/privacy" element={<PolicyPage />} />
          {/* Вход, регистрация, восстановление пароля и ссылка-приглашение (B6). */}
          <Route path="/register" element={<LoginPage mode="register" />} />
          <Route path="/reset" element={<ResetEntryPage />} />
          <Route path="/reset/confirm/:token" element={<ResetNewPasswordPage />} />
          <Route path="/join" element={<JoinRoute />} />
          <Route path="/join/:code" element={<JoinRoute />} />
          <Route element={<ProtectedRoute />}>
            {/* Мастер онбординга — фуллскрин, без сайдбара, вне AppLayout. */}
            <Route path="/onboarding" element={<Onboarding />} />
            {/* Квиз — фуллскрин, без сайдбара и нижней панели (spec 6.3). */}
            <Route path="/quiz/:lectureId" element={<QuizPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/s/:semesterSlug" element={<Dashboard />} />
              <Route path="/s/:semesterSlug/courses" element={<CoursesPage />} />
              {/* «Все лекции» (B2, pages/LecturesAllPage.tsx) — свой адрес,
                  чтобы не подсвечиваться одновременно с «Предметы». */}
              <Route path="/s/:semesterSlug/lectures" element={<LecturesAllPage />} />
              {/* Сводка по всем экзаменам семестра — статический сегмент
                  "exams" (RESERVED_SLUGS), встаёт до :courseSlug ниже. */}
              <Route path="/s/:semesterSlug/exams" element={<ExamsPage />} />
              {/* Экран «Моя группа» — статический сегмент "group"
                  (RESERVED_SLUGS), тоже до :courseSlug. */}
              <Route path="/s/:semesterSlug/group" element={<GroupHomeRoute />} />
              <Route path="/s/:semesterSlug/group/join" element={<GroupJoinRoute />} />
              <Route path="/s/:semesterSlug/group/new" element={<GroupCreatePage />} />
              <Route path="/s/:semesterSlug/group/lecture/:lectureId" element={<GroupLectureRoute />} />
              <Route path="/s/:semesterSlug/group/access" element={<GroupAccessRoute />} />
              <Route path="/s/:semesterSlug/group/settings" element={<GroupSettingsRoute />} />
              <Route path="/s/:semesterSlug/group/exams" element={<GroupExamsRoute />} />
              <Route path="/s/:semesterSlug/group/exams/:examId" element={<GroupExamRoute />} />
              <Route path="/s/:semesterSlug/group/exams/:examId/import" element={<GroupExamImportRoute />} />
              <Route path="/s/:semesterSlug/group/exams/:examId/ticket/:number" element={<GroupTicketRoute />} />
              <Route path="/s/:semesterSlug/group/people/:userId" element={<GroupMemberRoute />} />
              <Route path="/s/:semesterSlug/group/people/:userId/:courseKey" element={<GroupMemberSubjectRoute />} />
              {/* «Черновики» — предмет по умолчанию для лекций без предмета (B2). */}
              <Route path="/s/:semesterSlug/drafts" element={<DraftsPage />} />
              <Route path="/s/:semesterSlug/:courseSlug" element={<SubjectLecturesPage />} />
              {/* «Пары предмета» (B3, pages/SubjectPairsPage.tsx) — новый
                  экран, статический сегмент "pairs" (RESERVED_SLUGS), до
                  :lectureSlug ниже. Вход — из меню пары на /schedule
                  («Пары предмета»), подробности в docs/decisions.md. */}
              <Route
                path="/s/:semesterSlug/:courseSlug/pairs"
                element={<SubjectPairsPage />}
              />
              <Route path="/more" element={<MorePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              {/* Настройки, периоды учёбы и корзина (B6). */}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/periods" element={<SettingsPeriodsPage />} />
              <Route path="/trash" element={<TrashPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/note/new" element={<NewDraftRedirect />} />
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
                element={<TicketPage />}
              />
              <Route
                path="/s/:semesterSlug/:courseSlug/exam/:number/edit"
                element={<TicketPage />}
              />
              {/* Flashcards: cards module (not semester-scoped) */}
              <Route path="/decks" element={<CardsPage />} />
              <Route path="/decks/new" element={<DeckEditorPage />} />
              <Route path="/cards/review" element={<CardReviewPage />} />
              <Route path="/decks/:slug" element={<DeckPage />} />
              <Route path="/decks/:slug/review" element={<CardReviewPage />} />
              <Route path="/decks/:slug/edit" element={<DeckEditorPage />} />
              {/* Расписание и задачи — глобальные, вне семестра. */}
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/tasks" element={<TasksPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ToastProvider>
        </SemesterProvider>
      </SpeechProvider>
      </UndoProvider>
      </ModeProvider>
    </BrowserRouter>
  );
}

export default App;
