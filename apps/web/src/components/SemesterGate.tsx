/**
 * ============================================
 *  SemesterGate.tsx — semester guard wrapper
 * ============================================
 *
 * Renders its children only when the semester from the
 * URL is valid.  Otherwise it shows a centered
 * «Семестр «X» не найден» message, centralizing the
 * not-found handling that used to be duplicated in
 * Dashboard, CoursesPage and LecturesPage.
 */

import { useParams } from "react-router-dom";
import { useSemester } from "../lib/semesterContext";
import Header from "./Header";
import ErrorBanner from "./ErrorBanner";
import LoadingState from "./LoadingState";

/**
 * Guards the wrapped subtree against an unknown semester.
 *
 * @param children — page content rendered after validation
 */
function SemesterGate({ children }: { children: React.ReactNode }) {
  const { semesterSlug: semesterSlugParam } = useParams();
  const { current, loading } = useSemester();

  if (loading) return <LoadingState />;

  if (!current) {
    return (
      <>
        <Header crumbs={[{ label: "Рабочий стол" }]} />
        <div className="page">
          <ErrorBanner message={`Семестр «${semesterSlugParam}» не найден.`} />
        </div>
      </>
    );
  }

  return <>{children}</>;
}

export default SemesterGate;
