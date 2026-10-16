import { useNavigate } from "react-router-dom";
import { Link2 } from "lucide-react";
import type { ExamTicket } from "../lib/types";
import { ticketQuestion, courseSlug } from "../lib/types";
import { pluralRu } from "../lib/format";
import { lastSemesterSlug } from "../lib/lastSemester";

const MAX_CHIPS = 3;

/** Плашка «Нужна для N билетов» над тулбаром редактора (spec раздел 8). */
export default function LinkedTicketsPlaque({ tickets }: { tickets: ExamTicket[] }) {
  const navigate = useNavigate();
  if (tickets.length === 0) return null;

  const semSlug = lastSemesterSlug();
  const shown = tickets.slice(0, MAX_CHIPS);
  const rest = tickets.length - shown.length;

  function openTicket(t: ExamTicket) {
    const course = t.expand?.exam?.expand?.course;
    if (!course || !semSlug) return;
    navigate(`/s/${semSlug}/${courseSlug(course)}/exam/${t.number}`);
  }

  return (
    <div className="ds-root ds-callout" style={{ marginBottom: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: shown.length ? "var(--space-2)" : 0 }}>
        <Link2 size={15} aria-hidden="true" />
        <span className="ds-body">
          Нужна для {tickets.length}{" "}
          {pluralRu(tickets.length, ["билета", "билетов", "билетов"])}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            className="ds-badge ds-badge--neutral"
            style={{ cursor: "pointer", border: "none" }}
            onClick={() => openTicket(t)}
          >
            {t.number} · {ticketQuestion(t).slice(0, 40)}
          </button>
        ))}
        {rest > 0 && <span className="ds-badge ds-badge--neutral">+{rest}</span>}
      </div>
    </div>
  );
}
