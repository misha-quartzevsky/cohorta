import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { X, Check, MoreHorizontal } from "lucide-react";
import { useQuiz } from "../hooks/useQuiz";
import { fetchLecture } from "../services/lectureService";
import type { Lecture } from "../lib/types";
import { lectureHref } from "../lib/types";
import { lastSemesterSlug } from "../lib/lastSemester";
import { Button, ProgressBar, Menu, Badge } from "../components/ui";
import LoadingState from "../components/LoadingState";
import type { QuizSize } from "../services/quizService";
import { computeLectureReadiness } from "../lib/computeLectureReadiness";
import { fetchReadinessQuestions, fetchReadinessAnswers } from "../services/quizService";

const ERROR_MESSAGES: Record<string, string> = {
  not_enough_text:
    "В лекции пока мало текста. Допиши конспект, и мы соберём вопросы.",
  daily_limit: "На сегодня квизы закончились. Завтра будут снова.",
  generation_failed: "Не получилось собрать вопросы. Попробуй ещё раз.",
  unauthorized: "Сессия истекла. Обнови страницу и попробуй снова.",
  network: "Не получилось собрать вопросы. Попробуй ещё раз.",
};

/** Квиз по лекции (spec 6.2–6.3). Полноэкранный, без панелей каркаса. */
export default function QuizPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!lectureId) return;
    fetchLecture(lectureId)
      .then(setLecture)
      .catch(() => setLoadError("Не удалось загрузить лекцию."));
  }, [lectureId]);

  if (loadError) {
    return (
      <div className="ds-root" style={{ padding: "var(--space-6)" }}>
        <p className="ds-body">{loadError}</p>
        <Button onClick={() => navigate(-1)}>Назад</Button>
      </div>
    );
  }
  if (!lecture) return <LoadingState />;

  return <QuizRunner lecture={lecture} onExit={() => navigate(-1)} />;
}

function backToLecture(lecture: Lecture, navigate: ReturnType<typeof useNavigate>) {
  const semSlug = lastSemesterSlug();
  navigate(lectureHref(lecture, semSlug));
}

function QuizRunner({
  lecture,
  onExit,
}: {
  lecture: Lecture;
  onExit: () => void;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quiz = useQuiz(lecture);
  const requestedSize = parseInt(searchParams.get("size") ?? "8", 10);
  const size: QuizSize = [5, 8, 12].includes(requestedSize)
    ? (requestedSize as QuizSize)
    : 8;
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    // ?new=1 — «Собрать другой» из панели «Твоё понимание темы» (B1):
    // та же генерация, что и кнопка «Новый квиз» в итоге, но до старта.
    quiz.start(size, searchParams.get("new") === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRevealed(false);
    setSelected(null);
  }, [quiz.index]);

  if (quiz.phase === "loading") {
    return (
      <div className="ds-root ds-quiz-screen">
        <div className="ds-quiz-loading">
          <div className="ds-skeleton" style={{ height: 16, width: "60%", marginBottom: 12 }} />
          <div className="ds-skeleton" style={{ height: 16, width: "80%", marginBottom: 12 }} />
          <div className="ds-skeleton" style={{ height: 16, width: "40%" }} />
          <p className="ds-body" style={{ marginTop: "var(--space-5)" }}>
            Собираю вопросы по твоему конспекту…
          </p>
          <Button variant="secondary" onClick={onExit}>
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  if (quiz.phase === "error") {
    return (
      <div className="ds-root ds-quiz-screen">
        <div className="ds-quiz-loading">
          <p className="ds-body">{ERROR_MESSAGES[quiz.error ?? "generation_failed"]}</p>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {quiz.error !== "not_enough_text" && quiz.error !== "daily_limit" && (
              <Button onClick={quiz.retry}>Повторить</Button>
            )}
            <Button variant="secondary" onClick={onExit}>
              Назад
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (quiz.phase === "done") {
    return <QuizSummary lecture={lecture} quiz={quiz} onExit={() => backToLecture(lecture, navigate)} />;
  }

  const q = quiz.current;
  if (!q) return <LoadingState />;

  const total = quiz.questions.length;
  const answered = quiz.answers.find((a) => a.questionId === q.id);
  const showResult = revealed || !!answered;

  async function handleMcqSelect(i: number) {
    if (showResult) return;
    setSelected(i);
    setRevealed(true);
    await quiz.answerCurrent(i === q.correct_index);
  }

  async function handleRecall(remembered: boolean) {
    if (showResult) return;
    await quiz.answerCurrent(remembered);
  }

  return (
    <div className="ds-root ds-quiz-screen">
      <div className="ds-quiz-topbar">
        <span className="ds-caption ds-subtle-text">
          Вопрос {quiz.index + 1} из {total}
        </span>
        <Menu
          trigger={({ ref, onClick, ...aria }) => (
            <button ref={ref} type="button" className="ds-icon-btn" aria-label="Действия" onClick={onClick} {...aria}>
              <MoreHorizontal size={18} />
            </button>
          )}
          items={[
            { label: "Плохой вопрос", onClick: () => void quiz.flagCurrent() },
            { label: "Скрыть вопрос", onClick: () => void quiz.hideCurrent() },
          ]}
        />
        <button type="button" className="ds-icon-btn" aria-label="Выйти" onClick={onExit}>
          <X size={18} />
        </button>
      </div>
      <ProgressBar value={((quiz.index + (showResult ? 1 : 0)) / total) * 100} thin />

      <div className="ds-quiz-body">
        {q.topic && <div className="ds-overline ds-subtle-text">{q.topic}</div>}
        <h2 className="ds-h2" style={{ margin: "var(--space-2) 0 var(--space-5)" }}>
          {q.prompt}
        </h2>

        {q.type === "mcq" ? (
          <div className="ds-quiz-options">
            {(q.options ?? []).map((opt, i) => {
              let cls = "ds-quiz-option";
              if (showResult) {
                if (i === q.correct_index) cls += " ds-quiz-option--correct";
                else if (i === selected) cls += " ds-quiz-option--wrong";
              }
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  onClick={() => void handleMcqSelect(i)}
                  disabled={showResult}
                >
                  {opt}
                  {showResult && i === q.correct_index && <Check size={16} />}
                  {showResult && i === selected && i !== q.correct_index && <X size={16} />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="ds-quiz-recall">
            {!revealed ? (
              <Button onClick={() => setRevealed(true)}>Показать ответ</Button>
            ) : (
              <>
                <p className="ds-body" style={{ marginBottom: "var(--space-4)" }}>
                  {q.answer}
                </p>
                {!answered && (
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <Button onClick={() => void handleRecall(true)}>Помню</Button>
                    <Button variant="secondary" onClick={() => void handleRecall(false)}>
                      Не помню
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {showResult && (
          <div className="ds-callout" style={{ marginTop: "var(--space-5)" }}>
            <p className="ds-body">{q.explanation}</p>
            {q.quote && (
              <button
                type="button"
                className="ds-btn ds-btn--ghost"
                style={{ marginTop: "var(--space-2)", paddingLeft: 0 }}
                onClick={() =>
                  navigate(lectureHref(lecture, lastSemesterSlug()), {
                    state: { highlightQuote: q.quote },
                  })
                }
              >
                Показать в конспекте
              </button>
            )}
          </div>
        )}
      </div>

      {showResult && (
        <div className="ds-quiz-footer">
          <Button onClick={quiz.next} block>
            Далее
          </Button>
        </div>
      )}
    </div>
  );
}

function QuizSummary({
  lecture,
  quiz,
  onExit,
}: {
  lecture: Lecture;
  quiz: ReturnType<typeof useQuiz>;
  onExit: () => void;
}) {
  const [readiness, setReadiness] = useState<ReturnType<
    typeof computeLectureReadiness
  > | null>(null);

  useEffect(() => {
    void (async () => {
      const [qs, ans] = await Promise.all([
        fetchReadinessQuestions(lecture.id),
        fetchReadinessAnswers(lecture.id),
      ]);
      setReadiness(computeLectureReadiness(qs, ans, new Date()));
    })();
  }, [lecture.id]);

  const total = quiz.questions.length;

  return (
    <div className="ds-root ds-quiz-screen">
      <div className="ds-quiz-body" style={{ textAlign: "center" }}>
        <p className="ds-numeric" style={{ fontSize: "var(--text-numeric-xl)", fontWeight: 500 }}>
          {quiz.correctCount} из {total}
        </p>
        {readiness && readiness.topics.length > 0 && (
          <div style={{ textAlign: "left", marginTop: "var(--space-5)" }}>
            {readiness.topics.map((t) => (
              <div
                key={t.topic}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--color-line)",
                }}
              >
                <span className="ds-body" style={{ textTransform: "capitalize" }}>{t.topic}</span>
                <Badge tone={t.status === "success" ? "success" : t.status === "danger" ? "danger" : "neutral"}>
                  {t.correct} из {t.total}
                </Badge>
              </div>
            ))}
            {readiness.weakTopics.length > 0 && (
              <p className="ds-caption ds-subtle-text" style={{ marginTop: "var(--space-3)" }}>
                Слабее всего: {readiness.weakTopics.map((t) => t.topic).join(", ")}
              </p>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-6)" }}>
          <Button onClick={onExit} block>
            Вернуться к лекции
          </Button>
          <Button variant="secondary" onClick={quiz.restartSame} block>
            Ещё раз
          </Button>
          <Button variant="ghost" onClick={quiz.restartNew} block>
            Новый квиз
          </Button>
        </div>
      </div>
    </div>
  );
}
