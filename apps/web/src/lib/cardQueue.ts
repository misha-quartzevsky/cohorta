/**
 * Очередь повторения карточек. Логика прежняя (FlashcardPlayer): «знаю» — карточка
 * уходит, «повторить» — уходит в конец очереди. Новый экран (Screen-cards-review)
 * показывает четыре кнопки, но расписания повторов в базе нет (решение владелицы,
 * B5: только оболочка), поэтому «Снова» и «Трудно» работают как «повторить»,
 * «Хорошо» и «Легко» — как «знаю».
 */

export type Rating = "again" | "hard" | "good" | "easy";

export const RATINGS: { value: Rating; label: string }[] = [
  { value: "again", label: "Снова" },
  { value: "hard", label: "Трудно" },
  { value: "good", label: "Хорошо" },
  { value: "easy", label: "Легко" },
];

export function isRepeat(r: Rating): boolean {
  return r === "again" || r === "hard";
}

export interface QueueState<T> {
  order: T[];
  pos: number;
  known: number;
  repeated: number;
  done: boolean;
}

export function startQueue<T>(items: T[]): QueueState<T> {
  return { order: items, pos: 0, known: 0, repeated: 0, done: items.length === 0 };
}

/** Оценить текущую карточку: вернуть новое состояние очереди. */
export function rate<T>(q: QueueState<T>, rating: Rating): QueueState<T> {
  if (q.done || q.pos >= q.order.length) return { ...q, done: true };
  const again = isRepeat(rating);
  const order = again ? [...q.order, q.order[q.pos]] : q.order;
  const pos = q.pos + 1;
  return {
    order,
    pos,
    known: q.known + (again ? 0 : 1),
    repeated: q.repeated + (again ? 1 : 0),
    done: pos >= order.length,
  };
}
