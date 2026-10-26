/**
 * Числа квиза, которые видны на экранах. Решение владелицы (B5, 2026-10-19):
 * минимум 300 знаков в конспекте и 5 созданных квизов в сутки. Дневной
 * лимит живёт на сервере (QUIZ_DAILY_LIMIT, functions/api/quiz/generate.ts)
 * и приходит в ответе 429 — здесь только порог по тексту, он нужен клиенту
 * заранее (кнопка «Создать квиз» и шкала «120 из 300»), поэтому дублирует
 * MIN_TEXT_LENGTH на сервере. Менять оба места вместе.
 */
export const QUIZ_MIN_CHARS = 300;

export type QuizSize = 5 | 8 | 12;

/** Варианты окна «Создать квиз» (Screen-quiz-states, блок 1). */
export const QUIZ_SIZES: { size: QuizSize; minutes: number }[] = [
  { size: 5, minutes: 3 },
  { size: 8, minutes: 5 },
  { size: 12, minutes: 8 },
];

export const QUIZ_DEFAULT_SIZE: QuizSize = 8;
