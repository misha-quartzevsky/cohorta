import { useNavigate } from "react-router-dom";
import { useLectureReadiness } from "../hooks/useLectureReadiness";
import { Button, StatusChip } from "../ui";
import { extractText } from "../lib/extractText";
import { lectureStatus, type TopicStatus, type LectureStatus } from "../lib/computeLectureReadiness";
import type { Lecture } from "../lib/types";

const MIN_CHARS = 400;

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

/** Бейдж статуса в состоянии 3 — тон и подпись по макету Screen-understanding. */
const STATUS_BADGE: Record<LectureStatus, { tone: "warn" | "neutral" | "ok"; label: string }> = {
  new: { tone: "neutral", label: "Новая" },
  review: { tone: "warn", label: "Повторить" },
  in_progress: { tone: "neutral", label: "В процессе" },
  done: { tone: "ok", label: "Готово" },
};

/**
 * «Твоё понимание темы» (B1) — три состояния, сверено с
 * `docs/design/screens/Screen-understanding.dc.html` и
 * `Screen-m-understanding.dc.html` (spec 6.5). Данные и формула —
 * `lib/computeLectureReadiness.ts`/`hooks/useLectureReadiness.ts`,
 * без изменений.
 */
export default function LectureReadinessAside({ lecture }: { lecture: Lecture }) {
  const navigate = useNavigate();
  const { readiness, hasQuiz, loading } = useLectureReadiness(lecture.id);

  if (loading) return null;

  const percent = readiness?.percent ?? null;
  const charCount = extractText(lecture.content ?? "").length;
  const canCreateQuiz = charCount >= MIN_CHARS;

  return (
    <aside className="c-lecture-aside">
      <div className="c-dash-card c-readiness">
        <span className="label">Твоё понимание темы</span>

        {percent === null ? (
          <>
            <div className="headline">
              <span className="pct dash">—</span>
              <StatusChip tone={hasQuiz ? "accent" : "neutral"}>
                {hasQuiz ? "Квиз готов" : "Пока нет данных"}
              </StatusChip>
            </div>
            <div className="track" />
            <p className="body-text">
              {hasQuiz
                ? "Квиз собран: 8 вопросов по твоему конспекту. Пройди его, и мы покажем, какие темы ты понимаешь, а какие стоит повторить."
                : "Здесь появится, насколько хорошо ты понимаешь эту лекцию. Чтобы узнать, создай квиз: он соберётся из твоего конспекта."}
            </p>
            {hasQuiz ? (
              <>
                <Button variant="primary" onClick={() => navigate(`/quiz/${lecture.id}`)}>
                  Пройти квиз
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/quiz/${lecture.id}?new=1`)}
                >
                  Собрать другой
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  disabled={!canCreateQuiz}
                  onClick={() => navigate(`/quiz/${lecture.id}`)}
                >
                  Создать квиз
                </Button>
                <span className="hint">
                  {canCreateQuiz
                    ? "8 вопросов, около 5 минут. Нужен хотя бы один абзац текста."
                    : "Допиши конспект хотя бы на один абзац — тогда можно будет создать квиз."}
                </span>
              </>
            )}
          </>
        ) : (
          <>
            <div className="headline">
              <span className="pct">{percent}%</span>
              <StatusChip tone={STATUS_BADGE[lectureStatus(percent)].tone}>
                {STATUS_BADGE[lectureStatus(percent)].label}
              </StatusChip>
            </div>
            <span className="hint">Считается по твоим ответам в квизах по этой лекции.</span>

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

            <div className="plaque">{reminderText(readiness?.lastActivityAt ?? null)}</div>
            <Button variant="primary" onClick={() => navigate(`/quiz/${lecture.id}`)}>
              Проверить себя
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}

/** Плашка-напоминание: 3 дня после последнего ответа (spec 6.5). */
function reminderText(lastActivityAt: Date | null): string {
  if (!lastActivityAt) return "Через 3 дня стоит проверить себя ещё раз: так тема закрепится.";
  const daysSince = Math.floor((Date.now() - lastActivityAt.getTime()) / 86400000);
  return daysSince >= 3
    ? "Пора проверить себя ещё раз."
    : "Через 3 дня стоит проверить себя ещё раз: так тема закрепится.";
}
