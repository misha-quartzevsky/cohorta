/**
 * ============================================
 *  ExamImportPage.tsx — «Импорт билетов» личного экзамена
 * ============================================
 *
 * Экран и разбор — components/exam/ImportScreen.tsx и lib/examImport.ts (общие с экзаменом группы).
 * Билеты кладутся в экзамен этого предмета, номера идут после уже существующих.
 */

import { useNavigate, useParams } from "react-router-dom";

import ImportScreen from "../components/exam/ImportScreen";
import { useSemester } from "../lib/semesterContext";
import { useCourseBySlug } from "../hooks/useCourseBySlug";
import { useExam } from "../hooks/useExam";
import { courseName, semesterSlug, ticketNumber } from "../lib/types";
import { examDateLabel } from "../lib/groupExamText";
import { createExam, createTicketsBulk } from "../services/examService";

export default function ExamImportPage() {
  const navigate = useNavigate();
  const { courseSlug: courseSlugParam } = useParams();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "";
  const base = `/s/${semSlug}/${courseSlugParam}`;

  const { course } = useCourseBySlug(courseSlugParam ?? "");
  const { exam, tickets, loading } = useExam(course?.id ?? "", !!course);
  if (!course || loading) return null;

  return (
    <ImportScreen
      crumbs={[{ label: courseName(course), to: base }, { label: "Экзамен", to: `${base}/exam` }, { label: "Импорт" }]}
      back={{ label: "Экзамен", to: `${base}/exam` }}
      subtitle={`${courseName(course)} · ${examDateLabel(exam?.exam_date)}`}
      existingNumbers={tickets.map((t) => ticketNumber(t))}
      onSubmit={async (numbered) => {
        const target = exam ?? (await createExam({ courseId: course.id }));
        await createTicketsBulk(target.id, numbered);
      }}
      onDone={() => navigate(`${base}/exam`)}
    />
  );
}
