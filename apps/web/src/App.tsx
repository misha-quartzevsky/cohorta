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
import DashboardNew from "./pages/DashboardNew";
import CoursesPage from "./pages/CoursesPage";
import LecturesPage from "./pages/LecturesPage";
import LecturesAllPage from "./pages/LecturesAllPage";
import SubjectLecturesPage from "./pages/SubjectLecturesPage";
import DraftsPage from "./pages/DraftsPage";
import LectureViewNew from "./pages/LectureView";
import LectureViewLegacy from "./pages/LectureViewLegacy";
import NotesPage from "./pages/NotesPage";
import NewDraftRedirect from "./pages/NewDraftRedirect";
import NoteCreate from "./pages/NoteCreate";
import CardLibraryPage from "./pages/CardLibraryPage";
import CardStudyPage from "./pages/CardStudyPage";
import DeckEditorPage from "./pages/DeckEditorPage";
import ExamsPage from "./pages/ExamsPage";
import GroupPage from "./pages/GroupPage";
import ExamHubPage from "./pages/ExamHubPage";
import ExamHubPageNew from "./pages/ExamHubPageNew";
import ExamImportPage from "./pages/ExamImportPage";
import ExamImportPageNew from "./pages/ExamImportPageNew";
import TicketView from "./pages/TicketView";
import TicketEdit from "./pages/TicketEdit";
import TicketPageNew from "./pages/TicketPageNew";
import CheatsheetPage from "./pages/CheatsheetPage";
import CheatsheetPageNew from "./pages/CheatsheetPageNew";
import ProtectedRoute from "./components/ProtectedRoute";
import MorePage from "./pages/MorePage";
import CardsPageNew from "./pages/CardsPageNew";
import DeckPageNew from "./pages/DeckPageNew";
import CardReviewPageNew from "./pages/CardReviewPageNew";
import ProfilePage from "./pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";
import SettingsPage from "./pages/SettingsPage";
import SettingsPeriodsPage from "./pages/SettingsPeriodsPage";
import TrashPage from "./pages/TrashPage";
import LoadingState from "./components/LoadingState";
import ErrorBanner from "./components/ErrorBanner";
import Header from "./components/Header";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import PrivacyPage from "./pages/PrivacyPage";
import LoginPageNew from "./pages/auth/LoginPageNew";
import PolicyPageNew from "./pages/auth/PolicyPageNew";
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
  GroupTicketRoute,
  GroupCreatePage,
} from "./pages/group/GroupRoutes";
import OnboardingWizard from "./features/onboarding/OnboardingWizard";
import OnboardingNew from "./features/onboarding/OnboardingNew";
import LectureLayout from "./components/LectureLayout";
import AppLayout from "./components/AppLayout";
import { SemesterProvider } from "./lib/SemesterProvider";
import { SpeechProvider } from "./lib/SpeechProvider";
import { ModeProvider } from "./lib/ModeProvider";
import { UndoProvider } from "./lib/undoContext";
import { ToastProvider } from "./components/ui";
import SchedulePage from "./pages/SchedulePage";
import SchedulePageNew from "./pages/SchedulePageNew";
import TasksPage from "./pages/TasksPage";
import TasksPageNew from "./pages/TasksPageNew";
import SubjectPairsPage from "./pages/SubjectPairsPage";
import QuizPage from "./pages/QuizPage";
import DesignPage from "./pages/DesignPage";
import {
  useSemester,
  LAST_SEMESTER_KEY,
} from "./lib/semesterContext";
import { semesterSlug } from "./lib/types";
import { isNewUI } from "./lib/featureFlags";
import { LAND_IN_GROUP_KEY } from "./pages/auth/JoinGroupPage";
import "./App.css";

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

/** Страница лекции: новая за флагом VITE_NEW_UI, прежняя пока флаг выключен (убрать в волне D). */
function LectureViewRoute() {
  return isNewUI() ? <LectureViewNew /> : <LectureViewLegacy />;
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
          <Route path="/login" element={isNewUI() ? <LoginPageNew mode="login" /> : <Login />} />
          <Route path="/privacy" element={isNewUI() ? <PolicyPageNew /> : <PrivacyPage />} />
          {/* Вход, регистрация, восстановление пароля и ссылка-приглашение
              (B6). Старый интерфейс держит всё на /login (Login.tsx). */}
          {isNewUI() && (
            <>
              <Route path="/register" element={<LoginPageNew mode="register" />} />
              <Route path="/reset" element={<ResetEntryPage />} />
              <Route path="/reset/confirm/:token" element={<ResetNewPasswordPage />} />
              <Route path="/join" element={<JoinRoute />} />
              <Route path="/join/:code" element={<JoinRoute />} />
            </>
          )}
          <Route element={<ProtectedRoute />}>
            {/* Мастер онбординга — фуллскрин, без сайдбара, вне AppLayout. */}
            <Route path="/onboarding" element={isNewUI() ? <OnboardingNew /> : <OnboardingWizard />} />
            {/* Квиз — фуллскрин, без сайдбара и нижней панели (spec 6.3). */}
            <Route path="/quiz/:lectureId" element={<QuizPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route
                path="/s/:semesterSlug"
                element={isNewUI() ? <DashboardNew /> : <Dashboard />}
              />
              <Route path="/s/:semesterSlug/courses" element={<CoursesPage />} />
              {/* «Все лекции» (B2, pages/LecturesAllPage.tsx) — свой адрес,
                  чтобы не подсвечиваться одновременно с «Предметы». За
                  флагом VITE_NEW_UI: старый интерфейс не знает этого
                  экрана, остаётся на алиасе к «Предметы». */}
              <Route
                path="/s/:semesterSlug/lectures"
                element={isNewUI() ? <LecturesAllPage /> : <CoursesPage />}
              />
              {/* Сводка по всем экзаменам семестра — статический сегмент
                  "exams" (RESERVED_SLUGS), встаёт до :courseSlug ниже. */}
              <Route path="/s/:semesterSlug/exams" element={<ExamsPage />} />
              {/* Экран «Моя группа» — статический сегмент "group"
                  (RESERVED_SLUGS), тоже до :courseSlug. */}
              <Route path="/s/:semesterSlug/group" element={isNewUI() ? <GroupHomeRoute /> : <GroupPage />} />
              {isNewUI() && (
                <>
                  <Route path="/s/:semesterSlug/group/join" element={<GroupJoinRoute />} />
                  <Route path="/s/:semesterSlug/group/new" element={<GroupCreatePage />} />
                  <Route path="/s/:semesterSlug/group/lecture/:lectureId" element={<GroupLectureRoute />} />
                  <Route path="/s/:semesterSlug/group/access" element={<GroupAccessRoute />} />
                  <Route path="/s/:semesterSlug/group/settings" element={<GroupSettingsRoute />} />
                  <Route path="/s/:semesterSlug/group/exams" element={<GroupExamsRoute />} />
                  <Route path="/s/:semesterSlug/group/exams/:examId" element={<GroupExamRoute />} />
                  <Route path="/s/:semesterSlug/group/exams/:examId/ticket/:number" element={<GroupTicketRoute />} />
                  <Route path="/s/:semesterSlug/group/people/:userId" element={<GroupMemberRoute />} />
                  <Route path="/s/:semesterSlug/group/people/:userId/:courseKey" element={<GroupMemberSubjectRoute />} />
                </>
              )}
              {/* «Черновики» — предмет по умолчанию для лекций без предмета (B2). */}
              {isNewUI() && <Route path="/s/:semesterSlug/drafts" element={<DraftsPage />} />}
              <Route
                path="/s/:semesterSlug/:courseSlug"
                element={isNewUI() ? <SubjectLecturesPage /> : <LecturesPage />}
              />
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
              <Route path="/note/new" element={isNewUI() ? <NewDraftRedirect /> : <NoteCreate />} />
              {/* Lecture view + edit are ONE surface (Notion-style inline
                  editing): LectureView shows the record and mounts the editor
                  in place on first click. `/…/edit` stays as an alias that
                  simply opens straight in editor mode (external links, muscle
                  memory, tests). The header + course sidebar live in
                  LectureLayout and stay mounted while switching lectures. */}
              <Route element={<LectureLayout />}>
                <Route
                  path="/s/:semesterSlug/:courseSlug/:lectureSlug"
                  element={<LectureViewRoute />}
                />
                <Route
                  path="/s/:semesterSlug/:courseSlug/:lectureSlug/edit"
                  element={<LectureViewRoute />}
                />
                {/* Unassigned notes (no semester in URL) */}
                <Route
                  path="/note/:lectureSlug"
                  element={<LectureViewRoute />}
                />
                <Route
                  path="/note/:lectureSlug/edit"
                  element={<LectureViewRoute />}
                />
              </Route>
              {/* Exam Engine: экзамен — свойство курса, singleton внутри него.
                  Статический сегмент "exam" ранжируется React Router выше
                  динамического :lectureSlug на этом же месте, поэтому лекция
                  со слагом "exam" туда не попадёт (см. RESERVED_SLUGS). */}
              <Route
                path="/s/:semesterSlug/:courseSlug/exam"
                element={isNewUI() ? <ExamHubPageNew /> : <ExamHubPage />}
              />
              <Route
                path="/s/:semesterSlug/:courseSlug/exam/import"
                element={isNewUI() ? <ExamImportPageNew /> : <ExamImportPage />}
              />
              <Route
                path="/s/:semesterSlug/:courseSlug/exam/cheatsheet"
                element={isNewUI() ? <CheatsheetPageNew /> : <CheatsheetPage />}
              />
              <Route
                path="/s/:semesterSlug/:courseSlug/exam/:number"
                element={isNewUI() ? <TicketPageNew /> : <TicketView />}
              />
              <Route
                path="/s/:semesterSlug/:courseSlug/exam/:number/edit"
                element={isNewUI() ? <TicketPageNew /> : <TicketEdit />}
              />
              {/* Flashcards: cards module (not semester-scoped) */}
              <Route path="/decks" element={isNewUI() ? <CardsPageNew /> : <CardLibraryPage />} />
              <Route path="/decks/new" element={<DeckEditorPage />} />
              <Route path="/cards/review" element={<CardReviewPageNew />} />
              <Route path="/decks/:slug" element={isNewUI() ? <DeckPageNew /> : <CardStudyPage />} />
              <Route path="/decks/:slug/review" element={<CardReviewPageNew />} />
              <Route path="/decks/:slug/edit" element={<DeckEditorPage />} />
              {/* Расписание и задачи — глобальные, вне семестра. Новая
                  дизайн-основа (B3) — за флагом VITE_NEW_UI, как и
                  остальные перенесённые экраны волны B. */}
              <Route
                path="/schedule"
                element={isNewUI() ? <SchedulePageNew /> : <SchedulePage />}
              />
              <Route
                path="/tasks"
                element={isNewUI() ? <TasksPageNew /> : <TasksPage />}
              />
              {import.meta.env.DEV && (
                <Route path="/_design" element={<DesignPage />} />
              )}
            </Route>
          </Route>
          <Route path="*" element={isNewUI() ? <NotFoundPage /> : <Navigate to="/" replace />} />
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
