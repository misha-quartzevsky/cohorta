/**
 * ============================================
 *  CheatsheetPage.tsx — шпаргалка
 * ============================================
 *
 * Одна колонка, только билеты со статусом «готов», по возрастанию
 * номера. Расчёт на чтение с телефона в последний день перед
 * экзаменом — липкая мини-карта сверху для прыжка к нужному билету.
 */

import { useLayoutEffect, useRef } from "react";
import { useParams } from "react-router-dom";

import { useSemester } from "../lib/semesterContext";
import { useCourseBySlug } from "../hooks/useCourseBySlug";
import { useExam } from "../hooks/useExam";
import {
  courseName,
  examTitle,
  semesterSlug,
  ticketAnswer,
  ticketNumber,
  ticketQuestion,
  ticketStatus,
} from "../lib/types";
import { resolveFileTokensFor } from "../lib/fileTokens";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";
import { renderLatexInto } from "../components/math/renderLatex";

function CheatsheetPage() {
  const { courseSlug: courseSlugParam } = useParams();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "";
  const base = `/s/${semSlug}/${courseSlugParam}`;

  const { course, loading: courseLoading } = useCourseBySlug(
    courseSlugParam ?? ""
  );
  const { exam, tickets, loading: examLoading } = useExam(
    course?.id ?? "",
    !!course
  );

  const ready = tickets
    .filter((t) => ticketStatus(t) === "ready")
    .sort((a, b) => ticketNumber(a) - ticketNumber(b));

  const rootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const renderBlocks = () => {
      root
        .querySelectorAll<HTMLElement>("[data-type='math-block']")
        .forEach((block) => {
          void renderLatexInto(block, block.dataset.latex || "");
        });
    };
    renderBlocks();
    const t1 = window.setTimeout(renderBlocks, 120);
    const t2 = window.setTimeout(renderBlocks, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready.length]);

  const loading = courseLoading || examLoading;

  return (
    <SemesterGate>
      <Header
        crumbs={[
          { label: "Рабочий стол", to: `/s/${semSlug}` },
          { label: course ? courseName(course) : "Курс", to: base },
          { label: "Экзамен", to: `${base}/exam` },
          { label: "Шпаргалка" },
        ]}
      />
      <div className="page exam-cheatsheet" ref={rootRef}>
        {loading ? (
          <LoadingState />
        ) : !exam ? (
          <ErrorBanner message="Экзамен не найден." />
        ) : ready.length === 0 ? (
          <div className="empty">
            <p>Пока нет готовых билетов — отметь хотя бы один «готовым».</p>
          </div>
        ) : (
          <>
            <h1 className="page-title">{examTitle(exam)}</h1>
            <nav className="exam-cheatsheet-nav">
              {ready.map((t) => (
                <a key={t.id} href={`#ticket-${ticketNumber(t)}`}>
                  {ticketNumber(t)}
                </a>
              ))}
            </nav>
            {ready.map((t) => (
              <section
                key={t.id}
                id={`ticket-${ticketNumber(t)}`}
                className="exam-cheatsheet-ticket"
              >
                <h2
                  className="exam-cheatsheet-question"
                  data-number={ticketNumber(t)}
                >
                  {ticketQuestion(t)}
                </h2>
                <div
                  className="lecture-view-content is-html"
                  dangerouslySetInnerHTML={{
                    __html: resolveFileTokensFor(ticketAnswer(t), t),
                  }}
                />
              </section>
            ))}
          </>
        )}
      </div>
    </SemesterGate>
  );
}

export default CheatsheetPage;
