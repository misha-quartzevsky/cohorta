/**
 * ============================================
 *  CheatsheetPageNew.tsx — «Шпаргалка» (B4, 2026-10-20)
 * ============================================
 *
 * Вёрстка 1:1 по docs/design/screens/Screen-cheatsheet.dc.html (своей
 * телефонной версии в макете нет — по разделу 10 инструкции делаем по
 * десктопной версии: одна колонка и так уже узкая).
 *
 * Данные без изменений: только билеты со статусом «готов», по номеру —
 * как в старом CheatsheetPage.tsx.
 */

import { useLayoutEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";

import { Button, EmptyState, Icon } from "../ui";
import { useSemester } from "../lib/semesterContext";
import { useCourseBySlug } from "../hooks/useCourseBySlug";
import { useExam } from "../hooks/useExam";
import {
  courseName,
  semesterSlug,
  stripHtml,
  ticketAnswer,
  ticketNumber,
  ticketQuestion,
  ticketStatus,
} from "../lib/types";
import { resolveFileTokensFor } from "../lib/fileTokens";
import { pluralRu } from "../lib/format";
import { renderLatexInto } from "../components/math/renderLatex";

export default function CheatsheetPageNew() {
  const { courseSlug: courseSlugParam } = useParams();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "";
  const base = `/s/${semSlug}/${courseSlugParam}`;

  const { course } = useCourseBySlug(courseSlugParam ?? "");
  const { exam, tickets } = useExam(course?.id ?? "", !!course);

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
        .forEach((block) => void renderLatexInto(block, block.dataset.latex || ""));
    };
    renderBlocks();
    const t1 = window.setTimeout(renderBlocks, 120);
    const t2 = window.setTimeout(renderBlocks, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready.length]);

  async function copyAll() {
    const text = ready
      .map((t) => `${ticketNumber(t)}. ${ticketQuestion(t)}\n${stripHtml(resolveFileTokensFor(ticketAnswer(t), t))}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Буфер обмена недоступен (например, нет разрешения) — молча не падаем.
    }
  }

  if (!exam) return null;

  return (
    <div className="c-cheatsheet" ref={rootRef}>
      <div className="c-exam-crumb">
        <Link to={base}>{course ? courseName(course) : ""}</Link>
        <Icon name="chev" size={14} />
        <Link to={`${base}/exam`}>Экзамен</Link>
        <Icon name="chev" size={14} />
        <span className="current">Шпаргалка</span>
      </div>
      <div className="c-cheatsheet-head">
        <div>
          <h1>Шпаргалка</h1>
          <span>
            {course ? courseName(course) : ""} ·{" "}
            {ready.length === 1
              ? "1 готовый билет"
              : `${ready.length} ${pluralRu(ready.length, ["готовый билет", "готовых билета", "готовых билетов"])}`}{" "}
            из {tickets.length}
          </span>
        </div>
        {ready.length > 0 && (
          <Button variant="secondary" onClick={() => void copyAll()}>
            Скопировать текст
          </Button>
        )}
      </div>

      {ready.length === 0 ? (
        <EmptyState
          icon="doc"
          title="Пока нет готовых билетов"
          description="Отметь хотя бы один билет «готовым» — он появится здесь."
        />
      ) : (
        <div className="c-exam-card c-cheatsheet-card">
          <div className="c-cheatsheet-intro">
            Собрана из ответов на готовые билеты. Билеты в работе сюда не попадают.
          </div>
          {ready.map((t) => (
            <div key={t.id} className="c-cheatsheet-item">
              <span className="num">{ticketNumber(t)}</span>
              <div className="tx">
                <h2>{ticketQuestion(t)}</h2>
                <div
                  className="body lecture-view-content is-html"
                  dangerouslySetInnerHTML={{ __html: resolveFileTokensFor(ticketAnswer(t), t) }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
