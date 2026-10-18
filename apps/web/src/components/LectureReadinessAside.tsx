import { useNavigate } from "react-router-dom";
import { useLectureReadiness } from "../hooks/useLectureReadiness";
import { Button, StatusChip } from "../ui";
import type { TopicStatus } from "../lib/computeLectureReadiness";

const STATUS_BAR: Record<TopicStatus, string> = {
  danger: "var(--danger)",
  neutral: "var(--ink)",
  success: "var(--ok)",
};
const STATUS_TEXT: Record<TopicStatus, string> = {
  danger: "var(--danger-text)",
  neutral: "var(--ink-3)",
  success: "var(--ink-3)",
};

function percentTone(percent: number): "danger" | "warn" | "ok" {
  if (percent < 40) return "warn";
  if (percent < 75) return "warn";
  return "ok";
}

/**
 * «Твоё понимание темы» (B1, 2026-10-19) — переименовано с «Готовность
 * лекции»: слово «готовность» для лекции больше не используется.
 * Данные и формула — существовавшие ранее (lib/computeLectureReadiness.ts,
 * hooks/useLectureReadiness.ts), только новая вёрстка и слова.
 *
 * ВРЕМЕННО, без реального макета: Screen-understanding.dc.html и
 * Screen-m-understanding.dc.html, на которые просила ориентироваться
 * владелица, отсутствуют в docs/design/screens(-png)/ на момент
 * написания — их там физически нет. Три состояния ниже (нет данных /
 * нужно повторить / разобрался) — моя реконструкция по тексту
 * раздела 6.5 спецификации (он сам ещё не переписан под новое
 * название), не сверено с визуалом. Нужно поправить, когда макет
 * появится.
 *
 * Один вход в квиз (раздел B1 инструкции: «один вход в квиз как
 * нарисовано»).
 */
export default function LectureReadinessAside({ lectureId }: { lectureId: string }) {
  const navigate = useNavigate();
  const { readiness, loading } = useLectureReadiness(lectureId);

  if (loading) return null;

  const percent = readiness?.percent ?? null;

  return (
    <aside className="c-lecture-aside">
      <div className="c-dash-card c-readiness">
        <span className="label">Твоё понимание темы</span>

        {percent === null ? (
          // Состояние 1: ни одного квиза по лекции ещё не было.
          <>
            <div className="headline">
              <span className="pct dash">—</span>
            </div>
            <p className="hint">Посчитаем после первого квиза по этой лекции.</p>
          </>
        ) : (
          <>
            <div className="headline">
              <span className="pct">{percent}%</span>
              <StatusChip tone={percentTone(percent)}>
                {percent < 40 ? "Повторить" : percent < 75 ? "В работе" : "Разобрался"}
              </StatusChip>
            </div>
            <p className="hint">Считается по квизам и повторениям именно этой лекции.</p>
          </>
        )}

        {readiness && readiness.topics.length > 0 && (
          <>
            <hr />
            <span className="label">По темам</span>
            <div className="topics">
              {readiness.topics.map((t) => (
                <div key={t.topic} className="topic">
                  <div className="row">
                    <span>{t.topic}</span>
                    <span style={{ color: STATUS_TEXT[t.status] }}>
                      {t.correct} из {t.total}
                    </span>
                  </div>
                  <div className="bar">
                    <div
                      className="fill"
                      style={{
                        width: `${Math.round(t.accuracy * 100)}%`,
                        background: STATUS_BAR[t.status],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Button variant="primary" onClick={() => navigate(`/quiz/${lectureId}`)}>
          Проверить себя
        </Button>
      </div>
    </aside>
  );
}
