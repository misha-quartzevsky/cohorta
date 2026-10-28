/**
 * Автозадачи повторения (spec 5.3) — виртуальные подсказки, не хранятся,
 * пока пользователь с ними не взаимодействует. Чистая функция, без ИИ.
 *
 * Не завязана на семестр (расписание/задачи — вне семестра, см.
 * docs/decisions.md): лекция учитывается независимо от того, к какому
 * семестру относится её предмет, так смена семестра не меняет её поведение.
 */

import { READINESS_THRESHOLDS, type ReadinessResult } from "./computeLectureReadiness";
import type { Lecture } from "./types";
import { toDateStr, addDays, fromDateStr, MS_PER_DAY } from "./localDate";

export type SuggestionKind = "quiz_yesterday" | "review" | "stale";

export interface SuggestionLecture {
  id: Lecture["id"];
  title: Lecture["title"];
  /** Предмет лекции (id курса): подсказка получает тот же предмет при выполнении и скрытии. */
  subjectId?: string;
  /** Адрес лекции — куда ведёт подсказка «Давно не открывали». */
  lectureHref?: string;
  /** YYYY-MM-DD, дата конкретной пары/конспекта. Может отсутствовать. */
  lectureDate: string | null;
  /** YYYY-MM-DD, последняя правка записи (PocketBase `updated`). */
  updatedDate: string;
  /** Есть ли у лекции хотя бы один квиз (неважно, отвечали ли). */
  hasQuiz: boolean;
  /** Было ли хотя бы одно прохождение (любой ответ quiz_answers). */
  hasAnyAttempt: boolean;
  /** Готовность лекции (computeLectureReadiness().percent). */
  readinessPercent: ReadinessResult["percent"];
  /** YYYY-MM-DD последнего ответа или правки конспекта, что позже. */
  lastActivityDate: string | null;
}

export interface ReviewSuggestion {
  kind: SuggestionKind;
  lectureId: string;
  /** Заголовок подсказки, как в интерфейсе (spec 5.3). */
  title: string;
  dedupeKey: string;
  /** Предмет лекции. */
  subjectId?: string;
  /** Куда ведёт нажатие: квиз (подсказки 1 и 2) или лекция (подсказка 3). */
  href: string;
}

/** Порог «повторить» совпадает с порогом «Выучено» в готовности лекции: одно число на обоих экранах. */
const REVIEW_THRESHOLD = READINESS_THRESHOLDS.done;
const REVIEW_STALE_DAYS = 3;
const NOT_OPENED_DAYS = 7;
const MAX_SUGGESTIONS = 3;

function daysSince(dateStr: string | null, today: Date): number {
  if (!dateStr) return Infinity;
  const ms = today.getTime() - fromDateStr(dateStr).getTime();
  return Math.round(ms / MS_PER_DAY);
}

/**
 * `getReviewSuggestions(lectures, readinessByLecture, quizState, today)` —
 * здесь данные уже собраны в `SuggestionLecture` (готовность и состояние
 * квиза посчитаны заранее вызывающим кодом, как и в computeLectureReadiness).
 * `existingDedupeKeys` — dedupe_key записей `tasks`, которые уже выполнены
 * или скрыты (`dismissed=true`) и поэтому не должны показываться снова.
 */
export function getReviewSuggestions(
  allLectures: SuggestionLecture[],
  todayStr: string,
  existingDedupeKeys: ReadonlySet<string> = new Set()
): ReviewSuggestion[] {
  // Одна лекция — одна запись: повторы во входных данных не должны давать одинаковые строки.
  const lectures = allLectures.filter((l, i) => allLectures.findIndex((x) => x.id === l.id) === i);
  const today = fromDateStr(todayStr);
  const yesterdayStr = toDateStr(addDays(today, -1));

  function dedupeKey(kind: SuggestionKind, lectureId: string): string {
    return `${kind}:${lectureId}:${todayStr}`;
  }

  // 1. Квиз по вчерашней лекции: lecture_date = вчера ИЛИ обновлена вчера,
  // по которой ещё не было ни одного прохождения.
  const quizYesterday: ReviewSuggestion[] = lectures
    .filter(
      (l) =>
        !l.hasAnyAttempt &&
        (l.lectureDate === yesterdayStr || l.updatedDate === yesterdayStr)
    )
    .map((l) => ({
      kind: "quiz_yesterday" as const,
      lectureId: l.id,
      title: `Квиз по вчерашней лекции: ${l.title}`,
      subjectId: l.subjectId,
      href: `/quiz/${l.id}`,
      dedupeKey: dedupeKey("quiz_yesterday", l.id),
    }));

  // 2. Повторить лекцию: готовность < 75 (или null, но есть квиз),
  // последнее взаимодействие ≥ 3 дней назад.
  const review: ReviewSuggestion[] = lectures
    .filter((l) => {
      if (!l.hasQuiz) return false;
      const lowReadiness =
        l.readinessPercent === null || l.readinessPercent < REVIEW_THRESHOLD;
      if (!lowReadiness) return false;
      return daysSince(l.lastActivityDate, today) >= REVIEW_STALE_DAYS;
    })
    .sort(
      (a, b) =>
        daysSince(b.lastActivityDate, today) - daysSince(a.lastActivityDate, today)
    )
    .map((l) => ({
      kind: "review" as const,
      lectureId: l.id,
      title: `Повторить: ${l.title}`,
      subjectId: l.subjectId,
      href: `/quiz/${l.id}`,
      dedupeKey: dedupeKey("review", l.id),
    }));

  // 3. Давно не открывали: остальные лекции, не открытые ≥ 7 дней,
  // самая старая первой.
  const consideredIds = new Set([
    ...quizYesterday.map((s) => s.lectureId),
    ...review.map((s) => s.lectureId),
  ]);
  const stale: ReviewSuggestion[] = lectures
    .filter(
      (l) =>
        !consideredIds.has(l.id) && daysSince(l.updatedDate, today) >= NOT_OPENED_DAYS
    )
    .sort((a, b) => a.updatedDate.localeCompare(b.updatedDate))
    .map((l) => ({
      kind: "stale" as const,
      lectureId: l.id,
      title: `Давно не открывали: ${l.title}`,
      subjectId: l.subjectId,
      href: l.lectureHref ?? `/quiz/${l.id}`,
      dedupeKey: dedupeKey("stale", l.id),
    }));

  return [...quizYesterday, ...review, ...stale]
    .filter((s) => !existingDedupeKeys.has(s.dedupeKey))
    .slice(0, MAX_SUGGESTIONS);
}
