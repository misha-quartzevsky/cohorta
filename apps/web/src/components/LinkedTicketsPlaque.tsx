import { useNavigate } from "react-router-dom";
import { Icon } from "../ui";
import type { ExamTicket } from "../lib/types";
import { ticketQuestion, courseSlug } from "../lib/types";
import { pluralRu } from "../lib/format";
import { lastSemesterSlug } from "../lib/lastSemester";

const MAX_CHIPS = 3;

/**
 * Плашка «Нужна для N билетов» над тулбаром редактора (spec раздел 8).
 * Данные уже подключены (B1): запрос и показ/скрытие по наличию связей —
 * здесь только перенос вёрстки на токены c-* (B4).
 */
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
    <div className="c-ticket-plaque">
      <div className="c-ticket-plaque-head">
        <Icon name="link" size={15} aria-hidden="true" />
        <span>
          Нужна для {tickets.length}{" "}
          {pluralRu(tickets.length, ["билета", "билетов", "билетов"])}
        </span>
      </div>
      <div className="c-ticket-plaque-chips">
        {shown.map((t) => (
          <button
            key={t.id}
            type="button"
            className="c-ticket-plaque-chip"
            onClick={() => openTicket(t)}
          >
            {t.number} · {ticketQuestion(t).slice(0, 40)}
          </button>
        ))}
        {rest > 0 && <span className="c-ticket-plaque-chip more">+{rest}</span>}
      </div>
    </div>
  );
}
