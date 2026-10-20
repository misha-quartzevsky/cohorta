import type { ScheduleSlot } from "./types";

/** Две пары в одной клетке конфликтуют, если их чётность пересекается. */
export function parityOverlaps(a: string, b: string): boolean {
  if (a === "any" || b === "any") return true;
  return a === b;
}

export interface SlotCandidate {
  weekday: number;
  pair_number: number;
  week_parity: string;
}

/** Другая пара в той же клетке с пересекающейся чётностью (spec 2.2). `ownId` — правим эту пару. */
export function findSlotConflict(
  slots: ScheduleSlot[],
  candidate: SlotCandidate,
  ownId?: string
): ScheduleSlot | null {
  return (
    slots.find(
      (s) =>
        s.id !== ownId &&
        s.weekday === candidate.weekday &&
        s.pair_number === candidate.pair_number &&
        parityOverlaps(s.week_parity ?? "any", candidate.week_parity)
    ) ?? null
  );
}

export function parityPhrase(parity: string): string {
  if (parity === "odd") return "на нечётных неделях";
  if (parity === "even") return "на чётных неделях";
  return "на каждой неделе";
}
