import { describe, it, expect } from "vitest";
import { getReviewSuggestions, type SuggestionLecture } from "./getReviewSuggestions";

function lecture(partial: Partial<SuggestionLecture> & { id: string }): SuggestionLecture {
  return {
    title: "Лекция",
    lectureDate: null,
    updatedDate: "2026-10-20",
    hasQuiz: false,
    hasAnyAttempt: false,
    readinessPercent: null,
    lastActivityDate: null,
    ...partial,
  };
}

describe("getReviewSuggestions", () => {
  it("квиз по вчерашней лекции без прохождений — первый приоритет", () => {
    const today = "2026-10-20"; // вторник
    const lectures = [
      lecture({ id: "l1", lectureDate: "2026-10-19", hasAnyAttempt: false }),
    ];
    const result = getReviewSuggestions(lectures, today);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("quiz_yesterday");
    expect(result[0].dedupeKey).toBe("quiz_yesterday:l1:2026-10-20");
  });

  it("граничный день: сегодня понедельник, вчера — воскресенье", () => {
    const today = "2026-10-19"; // понедельник
    const lectures = [
      lecture({ id: "l1", lectureDate: "2026-10-18" /* воскресенье */, hasAnyAttempt: false }),
    ];
    const result = getReviewSuggestions(lectures, today);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("quiz_yesterday");
  });

  it("лекция обновлена вчера тоже считается, даже без lecture_date", () => {
    const today = "2026-10-20";
    const lectures = [
      lecture({ id: "l1", lectureDate: null, updatedDate: "2026-10-19", hasAnyAttempt: false }),
    ];
    const result = getReviewSuggestions(lectures, today);
    expect(result[0].kind).toBe("quiz_yesterday");
  });

  it("если прохождение уже было — квиз по вчерашней лекции не предлагается", () => {
    const today = "2026-10-20";
    const lectures = [
      lecture({ id: "l1", lectureDate: "2026-10-19", hasAnyAttempt: true }),
    ];
    expect(getReviewSuggestions(lectures, today)).toHaveLength(0);
  });

  it("повторить лекцию: готовность < 75 и давность ≥ 3 дней", () => {
    const today = "2026-10-20";
    const lectures = [
      lecture({
        id: "l1",
        hasQuiz: true,
        readinessPercent: 40,
        lastActivityDate: "2026-10-17", // 3 дня назад
        title: "Пределы",
      }),
    ];
    const result = getReviewSuggestions(lectures, today);
    expect(result[0].kind).toBe("review");
    expect(result[0].title).toBe("Повторить: Пределы");
  });

  it("повторить: готовность null, но квиз есть — тоже считается", () => {
    const today = "2026-10-20";
    const lectures = [
      lecture({ id: "l1", hasQuiz: true, readinessPercent: null, lastActivityDate: "2026-10-10" }),
    ];
    expect(getReviewSuggestions(lectures, today)[0].kind).toBe("review");
  });

  it("повторить: давность меньше 3 дней — не предлагается", () => {
    const today = "2026-10-20";
    const lectures = [
      lecture({ id: "l1", hasQuiz: true, readinessPercent: 30, lastActivityDate: "2026-10-19" }),
    ];
    expect(getReviewSuggestions(lectures, today)).toHaveLength(0);
  });

  it("повторить: готовность ≥ 75 — не предлагается", () => {
    const today = "2026-10-20";
    const lectures = [
      lecture({ id: "l1", hasQuiz: true, readinessPercent: 80, lastActivityDate: "2026-10-01" }),
    ];
    expect(getReviewSuggestions(lectures, today)).toHaveLength(0);
  });

  it("давно не открывали: ≥ 7 дней, самая старая первой", () => {
    const today = "2026-10-20";
    const lectures = [
      lecture({ id: "old", updatedDate: "2026-09-01", title: "Старая" }),
      lecture({ id: "newer", updatedDate: "2026-10-10", title: "Поновее" }),
      lecture({ id: "fresh", updatedDate: "2026-10-18", title: "Свежая" }), // < 7 дней
    ];
    const result = getReviewSuggestions(lectures, today);
    expect(result.map((r) => r.lectureId)).toEqual(["old", "newer"]);
  });

  it("не более 3 подсказок в день, порядок по приоритету", () => {
    const today = "2026-10-20";
    const lectures = [
      lecture({ id: "quiz1", lectureDate: "2026-10-19", hasAnyAttempt: false }),
      lecture({ id: "rev1", hasQuiz: true, readinessPercent: 20, lastActivityDate: "2026-10-01" }),
      lecture({ id: "stale1", updatedDate: "2026-09-01" }),
      lecture({ id: "stale2", updatedDate: "2026-09-05" }),
    ];
    const result = getReviewSuggestions(lectures, today);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.kind)).toEqual(["quiz_yesterday", "review", "stale"]);
  });

  it("лекция, уже учтённая в более приоритетной группе, не дублируется в «давно не открывали»", () => {
    const today = "2026-10-20";
    const lectures = [
      lecture({
        id: "l1",
        lectureDate: "2026-10-19",
        hasAnyAttempt: false,
        updatedDate: "2026-09-01", // формально тоже «давно не открывали»
      }),
    ];
    const result = getReviewSuggestions(lectures, today);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("quiz_yesterday");
  });

  it("dedupe_key выполненной/скрытой подсказки убирает её из выдачи", () => {
    const today = "2026-10-20";
    const lectures = [
      lecture({ id: "l1", lectureDate: "2026-10-19", hasAnyAttempt: false }),
    ];
    const excluded = new Set(["quiz_yesterday:l1:2026-10-20"]);
    expect(getReviewSuggestions(lectures, today, excluded)).toHaveLength(0);
  });

  it("граница смены семестра: лекция из прошлого семестра учитывается так же, как текущая (функция семестра не знает)", () => {
    // Задачи и расписание — вне семестра (docs/decisions.md): лекция из
    // семестра, который уже закончился 1 сентября, продолжает считаться
    // «давно не открытой» точно так же, как лекция текущего семестра —
    // функция не фильтрует и не знает о `semester`/`is_current`.
    const today = "2026-10-20";
    const lastSemesterLecture = lecture({ id: "old-sem", updatedDate: "2026-06-01" });
    const currentSemesterLecture = lecture({ id: "cur-sem", updatedDate: "2026-06-01" });
    const result = getReviewSuggestions(
      [lastSemesterLecture, currentSemesterLecture],
      today
    );
    expect(result.map((r) => r.lectureId).sort()).toEqual(["cur-sem", "old-sem"]);
  });

  it("пустой список лекций — пустой результат", () => {
    expect(getReviewSuggestions([], "2026-10-20")).toEqual([]);
  });
});
