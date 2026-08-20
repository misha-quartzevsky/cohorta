/**
 * ============================================
 *  useActivityTimeline.ts — Activity Timeline Hook
 * ============================================
 *
 * Строит «ленту последней активности» для Dashboard из самых свежих
 * лекций/заметок. Каждый элемент решает путь навигации и подпись времени.
 */

import { useRecentLectures } from "./useRecentLectures";
import { useDecks } from "./useDecks";
import { useSemester } from "../lib/semesterContext";
import {
  courseName,
  courseSlug,
  lectureCourseId,
  lectureSlug,
  lectureTitle,
  semesterSlug,
  deckTitle,
  deckSlug,
  type Lecture,
  type Deck,
} from "../lib/types";
import { timeAgo } from "../lib/format";

export interface TimelineItem {
  id: string;
  type: "lecture" | "note" | "deck";
  title: string;
  /** Название курса (только для лекций, привязанных к курсу). */
  course?: string;
  /** Относительное время, напр. «15 мин. назад». */
  time: string;
  /** Путь навигации. */
  to: string;
}

/** Превращает лекцию в элемент ленты. */
function toItem(lec: Lecture, semSlug: string): TimelineItem {
  const courseId = lectureCourseId(lec);
  const course = courseId ? lec.expand?.field : undefined;
  const unassigned = !course;

  return {
    id: lec.id,
    type: unassigned ? "note" : "lecture",
    title: lectureTitle(lec),
    course: course ? courseName(course) : undefined,
    time: timeAgo(lec.updated),
    to: unassigned
      ? `/note/${lectureSlug(lec)}`
      : `/s/${semSlug}/${courseSlug(course!)}/${lectureSlug(lec)}`,
  };
}

/** Превращает колоду в элемент ленты. */
function toDeckItem(deck: Deck): TimelineItem {
  return {
    id: deck.id,
    type: "deck",
    title: deckTitle(deck),
    time: timeAgo(deck.updated),
    to: `/decks/${deckSlug(deck)}`,
  };
}

/**
 * @param limit — сколько последних событий вернуть (default 10)
 */
export function useActivityTimeline(limit: number = 10): TimelineItem[] {
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "1";
  const { lectures } = useRecentLectures(limit * 2);
  const { decks } = useDecks(limit * 2);

  // Сортируем по реальному времени обновления (ISO-строки сравниваются
  // лексикографически), а не по русской относительной подписи.
  const raw: Array<{ updated: string; make: () => TimelineItem }> = [
    ...lectures.map((lec) => ({
      updated: lec.updated,
      make: () => toItem(lec, semSlug),
    })),
    ...decks.map((deck) => ({
      updated: deck.updated,
      make: () => toDeckItem(deck),
    })),
  ];

  raw.sort((a, b) => b.updated.localeCompare(a.updated));
  return raw.slice(0, limit).map((x) => x.make());
}
