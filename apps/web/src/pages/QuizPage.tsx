import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuiz, type QuizMode, type UseQuizResult } from "../hooks/useQuiz";
import { fetchLecture } from "../services/lectureService";
import type { Lecture } from "../lib/types";
import { courseName, lectureCourseId, lectureHref } from "../lib/types";
import { semesterSlugForLecture } from "../lib/lectureSemester";
import { useSemester } from "../lib/semesterContext";
import { pb } from "../lib/pocketbase";
import { attemptStats, understandingBeforeAfter, understandingLabel } from "../lib/quizSummary";
import { Button, Icon, StatusChip } from "../ui";
import LoadingState from "../components/LoadingState";

const LETTERS = ["A", "B", "C", "D"];

function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseMode(v: string | null): QuizMode {
  return v === "continue" || v === "restart" || v === "again" ? v : "auto";
}

/**
 * Квиз по лекции (Screen-quiz-question / -answered / -summary, телефон —
 * Screen-m-quiz). Полноэкранный, вне каркаса. Создание квиза — не здесь:
 * оно в панели «Твоё понимание темы» (components/quiz/).
 * Вход: `/quiz/:lectureId[?mode=continue|restart|again]`.
 */
export default function QuizPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!lectureId) return;
    fetchLecture(lectureId, "field")
      .then(setLecture)
      .catch(() => setLoadError(true));
  }, [lectureId]);

  if (loadError) {
    return (
      <div className="c-quiz">
        <div className="c-quiz-center">
          <p className="c-quiz-note">Не получилось открыть лекцию. Вернись назад и попробуй ещё раз.</p>
          <Button variant="primary" onClick={() => navigate(-1)}>
            Назад
          </Button>
        </div>
      </div>
    );
  }
  if (!lecture) return <LoadingState />;

  return <QuizRunner lecture={lecture} mode={parseMode(searchParams.get("mode"))} />;
}

function QuizRunner({ lecture, mode }: { lecture: Lecture; mode: QuizMode }) {
  const navigate = useNavigate();
  const quiz = useQuiz(lecture.id, mode);
  const { semesters } = useSemester();
  const semSlug = semesterSlugForLecture(lecture, semesters);
  const isOwner = String(lecture.owner ?? "") === String(pb.authStore.record?.id ?? "");
  const toLecture = (state?: unknown) => navigate(lectureHref(lecture, semSlug), state ? { state } : undefined);

  // Квиза ещё нет (например, пришли по задаче): возвращаем к лекции, где его можно создать.
  useEffect(() => {
    if (quiz.phase === "empty") {
      navigate(lectureHref(lecture, semSlug), {
        replace: true,
        state: isOwner ? { openQuizCreate: true } : undefined,
      });
    }
  }, [quiz.phase, lecture, navigate, isOwner, semSlug]);

  if (quiz.phase === "loading" || quiz.phase === "empty") return <LoadingState />;

  if (quiz.phase === "error") {
    return (
      <div className="c-quiz">
        <div className="c-quiz-center">
          <p className="c-quiz-note">Не получилось загрузить квиз. Попробуй ещё раз.</p>
          <div className="c-quiz-actions-row">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Повторить
            </Button>
            <Button variant="ghost" onClick={() => toLecture()}>
              К лекции
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (quiz.phase === "done") return <QuizSummary lecture={lecture} quiz={quiz} onExit={() => toLecture()} />;

  return <QuizQuestionView lecture={lecture} quiz={quiz} isOwner={isOwner} onExit={() => toLecture()} />;
}

function QuizQuestionView({
  lecture,
  quiz,
  isOwner,
  onExit,
}: {
  lecture: Lecture;
  quiz: UseQuizResult;
  isOwner: boolean;
  onExit: () => void;
}) {
  const navigate = useNavigate();
  const { semesters } = useSemester();
  const semSlug = semesterSlugForLecture(lecture, semesters);
  const q = quiz.current!;
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [answerShown, setAnswerShown] = useState(false);

  const course = lectureCourseId(lecture) ? lecture.expand?.field : undefined;
  const courseLabel = course ? courseName(course) : "";
  const isMcq = q.type === "mcq";

  // Новый вопрос — чистое состояние.
  useEffect(() => {
    setSelected(null);
    setRevealed(false);
    setSkipped(false);
    setAnswerShown(false);
  }, [q.id]);

  async function submitMcq() {
    if (revealed || selected === null) return;
    setRevealed(true);
    await quiz.answerCurrent(selected === q.correct_index);
  }
  async function dontRemember() {
    if (revealed) return;
    setSkipped(true);
    setRevealed(true);
    await quiz.answerCurrent(false);
  }
  async function recall(remembered: boolean) {
    if (revealed) return;
    setRevealed(true);
    await quiz.answerCurrent(remembered);
  }

  // Клавиатура: 1–4 выбирают вариант, Enter отвечает / идёт дальше (spec 6.3).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement | null)?.closest("button, a, input, textarea")) {
        if (e.key !== "Enter") return;
        return; // Enter на кнопке сработает как клик
      }
      if (isMcq && !revealed && e.key >= "1" && e.key <= "4") {
        setSelected(Number(e.key) - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (revealed) quiz.next();
        else if (isMcq) void submitMcq();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const wrongText =
    isMcq && revealed && !skipped && selected !== null && selected !== q.correct_index
      ? ` Твой ответ: «${(q.options ?? [])[selected]}».`
      : "";

  const progress = (quiz.position / quiz.total) * 100;

  return (
    <div className="c-quiz">
      <header className="c-quiz-head">
        <div className="c-quiz-bar">
          <button type="button" className="c-quiz-exit-text" onClick={onExit}>
            <Icon name="x" size={18} />
            Выйти
          </button>
          <span className="c-quiz-count">
            Вопрос {quiz.position} из {quiz.total}
            {courseLabel ? ` · ${courseLabel}` : ""}
          </span>
          <button type="button" className="c-quiz-exit" aria-label="Выйти из квиза" onClick={onExit}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="c-quiz-track" role="progressbar" aria-valuemin={0} aria-valuemax={quiz.total} aria-valuenow={quiz.position}>
          <div style={{ width: `${progress}%` }} />
        </div>
        <span className="c-quiz-count-m">
          {quiz.position} из {quiz.total}
        </span>
      </header>

      <main className="c-quiz-main">
        <div className="c-quiz-col">
          {q.topic && <span className="c-quiz-topic">{q.topic}</span>}
          <h1 className="c-quiz-q">{q.prompt}</h1>

          {isMcq && (
            <div className="c-quiz-options" role="radiogroup" aria-label="Варианты ответа">
              {(q.options ?? []).map((opt, i) => {
                let state = "";
                if (revealed) {
                  if (i === q.correct_index) state = " ok";
                  else if (i === selected && !skipped) state = " bad";
                } else if (i === selected) state = " on";
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={i === selected}
                    className={`c-quiz-opt${state}`}
                    disabled={revealed}
                    onClick={() => setSelected(i)}
                  >
                    <span className="letter">{LETTERS[i]}</span>
                    <span className="radio">{i === selected && !revealed && <i />}</span>
                    <span className="tx">{opt}</span>
                    {revealed && i === q.correct_index && <Icon name="check" size={20} className="mark" />}
                    {revealed && i === selected && !skipped && i !== q.correct_index && (
                      <Icon name="x" size={20} className="mark" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!isMcq && answerShown && (
            <div className="c-quiz-card">
              <span className="c-quiz-card-label">Ответ</span>
              <span className="c-quiz-card-text">{q.answer}</span>
            </div>
          )}

          {revealed && (
            <div className="c-quiz-card">
              <span className="c-quiz-card-label">Объяснение</span>
              <span className="c-quiz-card-text">
                {q.explanation}
                {wrongText}
              </span>
              {q.quote && (
                <button
                  type="button"
                  className="c-quiz-link"
                  onClick={() =>
                    navigate(lectureHref(lecture, semSlug), { state: { highlightQuote: q.quote } })
                  }
                >
                  Показать в лекции, абзац «{q.topic || lecture.title}»
                </button>
              )}
            </div>
          )}

          <div className="c-quiz-actions">
            {revealed ? (
              <>
                {/* «Плохой вопрос» меняет сам квиз — это может только владелец лекции. */}
                {isOwner ? (
                  <Button variant="ghost" onClick={() => void quiz.flagCurrent()}>
                    Плохой вопрос
                  </Button>
                ) : (
                  <span />
                )}
                <Button variant="primary" onClick={quiz.next}>
                  Дальше
                </Button>
              </>
            ) : isMcq ? (
              <>
                <Button variant="ghost" onClick={() => void dontRemember()}>
                  Не помню
                </Button>
                <Button variant="primary" disabled={selected === null} onClick={() => void submitMcq()}>
                  Ответить
                </Button>
              </>
            ) : answerShown ? (
              <>
                <Button variant="ghost" onClick={() => void recall(false)}>
                  Не помню
                </Button>
                <Button variant="primary" onClick={() => void recall(true)}>
                  Помню
                </Button>
              </>
            ) : (
              <>
                <span />
                <Button variant="primary" onClick={() => setAnswerShown(true)}>
                  Показать ответ
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function QuizSummary({
  lecture,
  quiz,
  onExit,
}: {
  lecture: Lecture;
  quiz: UseQuizResult;
  onExit: () => void;
}) {
  const stats = attemptStats(quiz.questions, quiz.answers);
  const { before, after } = understandingBeforeAfter(quiz.readinessQuestions, quiz.allAnswers, quiz.attempt, new Date());
  const chip = understandingLabel(before, after);
  const weak = stats.weak;
  const canRepeat = weak.length > 0;

  return (
    <div className="c-quiz">
      <header className="c-quiz-head summary">
        <div className="c-quiz-bar">
          <span />
          <button type="button" className="c-quiz-exit" aria-label="Закрыть" onClick={onExit}>
            <Icon name="x" size={18} />
          </button>
        </div>
      </header>

      <main className="c-quiz-main">
        <div className="c-quiz-col">
          <div className="c-quiz-sum-head">
            <span className="c-quiz-sum-sub">Квиз по лекции «{lecture.title}»</span>
            <div className="c-quiz-sum-row">
              <h1>
                {stats.correct} из {stats.total}
              </h1>
              {chip && <StatusChip tone={before !== null && after !== null && after > before ? "ok" : "neutral"}>{chip}</StatusChip>}
            </div>
          </div>

          {stats.topics.length > 0 && (
            <div className="c-quiz-sum-card">
              <span className="c-quiz-card-label">По темам лекции</span>
              {stats.topics.map((t) => {
                const isWeak = t.accuracy < 0.6;
                return (
                  <div key={t.key} className="topic">
                    <div className="row">
                      <span>{upperFirst(t.label)}</span>
                      <span className={isWeak ? "weak" : ""}>
                        {t.correct} из {t.total}
                      </span>
                    </div>
                    <div className="bar">
                      <div className={isWeak ? "weak" : ""} style={{ width: `${t.accuracy * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              {canRepeat && (
                <>
                  <hr />
                  <span className="c-quiz-sum-weak">
                    Слабее всего: <b>{weak.map((t) => t.label.toLowerCase()).join(", ")}</b>. Перечитай абзац и вернись
                    к квизу через день, так лучше запоминается.
                  </span>
                </>
              )}
            </div>
          )}

          <div className="c-quiz-sum-actions">
            {canRepeat && (
              <Button variant="primary" onClick={() => quiz.startWeak(weak.map((t) => t.key))}>
                Повторить слабые темы
              </Button>
            )}
            <Button variant={canRepeat ? "secondary" : "primary"} onClick={onExit}>
              К лекции
            </Button>
            <Button variant="ghost" onClick={onExit}>
              Закрыть
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
