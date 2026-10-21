import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Modal, StatusChip } from "../../ui";
import { useLectureReadiness } from "../../hooks/useLectureReadiness";
import { extractText } from "../../lib/extractText";
import { lectureStatus, type LectureStatus, type TopicStatus } from "../../lib/computeLectureReadiness";
import { closeDialog, openCreate, useCreation } from "../../lib/quizCreation";
import { QUIZ_DEFAULT_SIZE } from "../../lib/quizLimits";
import { pluralRu } from "../../lib/format";
import { pb } from "../../lib/pocketbase";
import { fetchLecture } from "../../services/lectureService";
import type { Lecture } from "../../lib/types";
import QuizCreateDialog from "./QuizCreateDialog";
import { Ctx, useUnderstanding, type Value } from "./understandingContext";

/**
 * Панель «Твоё понимание темы» (Screen-understanding, Screen-m-understanding,
 * Screen-quiz-states блок 6) — четыре состояния, выбираются сами:
 * квиза нет / квиз собран, не пройден / квиз начат / квиз пройден.
 * Данные и формула — lib/computeLectureReadiness.ts, состояние —
 * lib/quizPanelState.ts. Один набор данных на сайдбар-панель на компьютере и
 * на шторку на телефоне: поэтому есть общий контекст.
 */

export function UnderstandingScope({ lecture, children }: { lecture: Lecture | null; children: ReactNode }) {
  const lectureId = lecture?.id ?? "";
  const creation = useCreation(lectureId);
  const { readiness, hasQuiz, panel, loading } = useLectureReadiness(lecture?.id, creation.version);
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isOwner = !!lecture && String(lecture.owner ?? "") === String(pb.authStore.record?.id ?? "");
  const content = lecture?.content;
  const create = useCallback(
    async (forceNew: boolean) => {
      if (!lectureId || !isOwner) return;
      let textLength = extractText(content ?? "").length;
      try {
        textLength = extractText((await fetchLecture(lectureId)).content ?? "").length;
      } catch {
        /* нет связи с базой — считаем по тому, что на экране */
      }
      setSheetOpen(false);
      openCreate(lectureId, { forceNew, textLength });
    },
    [lectureId, content, isOwner]
  );

  // Пришли из квиза без собранного квиза (например по задаче): сразу предлагаем создать.
  useEffect(() => {
    const st = location.state as { openQuizCreate?: boolean } | null;
    // Ждём, пока лекция загрузится: иначе метка гасла раньше, чем было что открывать.
    if (st?.openQuizCreate && lectureId) {
      navigate(location.pathname, { replace: true, state: null });
      void create(false);
    }
  }, [location.state, location.pathname, navigate, create, lectureId]);

  // Окно не должно «переехать» на другую лекцию.
  useEffect(() => () => closeDialog(lectureId), [lectureId]);

  const value = useMemo<Value | null>(
    () =>
      lecture
        ? { lecture, readiness, panel, hasQuiz, loading, isOwner, sheetOpen, setSheetOpen, create }
        : null,
    [lecture, readiness, panel, hasQuiz, loading, isOwner, sheetOpen, create]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {lecture && (
        <>
          <UnderstandingSheet />
          <QuizCreateDialog
            lecture={lecture}
            charCount={extractText(lecture.content ?? "").length}
            hasQuiz={hasQuiz}
          />
        </>
      )}
    </Ctx.Provider>
  );
}

/** Правая колонка на компьютере. */
export function UnderstandingAside() {
  const v = useUnderstanding();
  if (!v || v.loading) return null;
  return (
    <aside className="c-lecture-aside">
      <div className="c-dash-card c-readiness">
        <PanelBody />
      </div>
    </aside>
  );
}

/** Открыть шторку «Твоё понимание темы» на телефоне (пункт меню лекции); вне страницы лекции — null. */
export function useOpenUnderstandingSheet(): (() => void) | null {
  const v = useUnderstanding();
  return v ? () => v.setSheetOpen(true) : null;
}

/** Кнопка «Понимание» в шапке на телефоне (в телефонном макете редактора её нет — вход из «···»). */
export function UnderstandingButton() {
  const v = useUnderstanding();
  if (!v) return null;
  return (
    <button type="button" className="c-shell-underst" onClick={() => v.setSheetOpen(true)}>
      Понимание
    </button>
  );
}

/** Нижняя шторка на телефоне (Screen-m-understanding). */
function UnderstandingSheet() {
  const v = useUnderstanding();
  if (!v) return null;
  return (
    <Modal
      open={v.sheetOpen && !v.loading}
      onClose={() => v.setSheetOpen(false)}
      title="Твоё понимание темы"
      bare
      className="c-sheet-dialog"
    >
      <div className="c-readiness in-sheet">
        <PanelBody />
      </div>
    </Modal>
  );
}

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

/** Бейдж статуса в состоянии «пройден» — тон и подпись по макету Screen-understanding. */
const STATUS_BADGE: Record<LectureStatus, { tone: "warn" | "neutral" | "ok"; label: string }> = {
  new: { tone: "neutral", label: "Новая" },
  review: { tone: "warn", label: "Повторить" },
  in_progress: { tone: "neutral", label: "В процессе" },
  done: { tone: "ok", label: "Готово" },
};

function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function PanelBody() {
  const v = useUnderstanding();
  const navigate = useNavigate();
  if (!v) return null;
  const { lecture, panel, readiness } = v;
  const go = (query = "") => {
    v.setSheetOpen(false);
    navigate(`/quiz/${lecture.id}${query}`);
  };

  if (panel.kind === "done") {
    const percent = readiness?.percent ?? 0;
    const badge = STATUS_BADGE[lectureStatus(percent)];
    return (
      <>
        <span className="label">Твоё понимание темы</span>
        <div className="headline">
          <span className="pct">{percent}%</span>
          <StatusChip tone={badge.tone}>{badge.label}</StatusChip>
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
                    <span>{upperFirst(t.topic)}</span>
                    <span style={{ color: STATUS_TEXT[t.status] }}>
                      {t.correct} из {t.total}
                    </span>
                  </div>
                  <div className="bar">
                    <div
                      className="fill"
                      style={{ width: `${Math.round(t.accuracy * 100)}%`, background: STATUS_BAR[t.status] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="plaque">{reminderText(readiness?.lastActivityAt ?? null)}</div>
        <Button variant="primary" onClick={() => go("?mode=again")}>
          Проверить себя
        </Button>
      </>
    );
  }

  if (panel.kind === "started") {
    return (
      <>
        <span className="label">Твоё понимание темы</span>
        <div className="headline">
          <span className="pct dash">—</span>
          <StatusChip tone="accent">В процессе</StatusChip>
        </div>
        <div className="track">
          <div className="fill" style={{ width: `${(panel.answered / panel.total) * 100}%` }} />
        </div>
        <p className="body-text">
          Ты ответил на {panel.answered} из {panel.total} {pluralRu(panel.total, ["вопроса", "вопросов", "вопросов"])}.
          Продолжай с того же места: прогресс сохранён.
        </p>
        <Button variant="primary" onClick={() => go("?mode=continue")}>
          Продолжить
        </Button>
        <Button variant="ghost" size="sm" onClick={() => go("?mode=restart")}>
          Начать заново
        </Button>
      </>
    );
  }

  if (panel.kind === "created") {
    return (
      <>
        <span className="label">Твоё понимание темы</span>
        <div className="headline">
          <span className="pct dash">—</span>
          <StatusChip tone="accent">Квиз готов</StatusChip>
        </div>
        <div className="track" />
        <p className="body-text">
          Квиз собран: {panel.total} {pluralRu(panel.total, ["вопрос", "вопроса", "вопросов"])} по твоему конспекту.
          Пройди его, и мы покажем, какие темы ты понимаешь, а какие стоит повторить.
        </p>
        <Button variant="primary" onClick={() => go()}>
          Пройти квиз
        </Button>
        {v.isOwner && (
          <Button variant="ghost" size="sm" onClick={() => void v.create(true)}>
            Собрать другой
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      <span className="label">Твоё понимание темы</span>
      <div className="headline">
        <span className="pct dash">—</span>
        <StatusChip tone="neutral">Пока нет данных</StatusChip>
      </div>
      <div className="track" />
      {v.isOwner ? (
        <>
          <p className="body-text">
            Здесь появится, насколько хорошо ты понимаешь эту лекцию. Чтобы узнать, создай квиз: он соберётся из твоего
            конспекта.
          </p>
          <Button variant="primary" onClick={() => void v.create(false)}>
            Создать квиз
          </Button>
          <span className="hint">
            {QUIZ_DEFAULT_SIZE} вопросов, около 5 минут. Нужен хотя бы один абзац текста.
          </span>
        </>
      ) : (
        <p className="body-text">Квиза по этой лекции пока нет. Его создаёт владелец лекции.</p>
      )}
    </>
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
