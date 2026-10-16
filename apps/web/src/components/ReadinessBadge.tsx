import { Badge } from "./ui";
import { lectureStatus } from "../lib/computeLectureReadiness";

const LABELS: Record<ReturnType<typeof lectureStatus>, string> = {
  new: "Новая",
  review: "Повторить",
  in_progress: "В процессе",
  done: "Готово",
};

const TONES: Record<ReturnType<typeof lectureStatus>, "neutral" | "danger" | "success"> = {
  new: "neutral",
  review: "danger",
  in_progress: "neutral",
  done: "success",
};

/** Badge статуса готовности лекции (spec 6.4–6.5). Никогда не «N билетов». */
export default function ReadinessBadge({ percent }: { percent: number | null }) {
  const status = lectureStatus(percent);
  return (
    <Badge tone={TONES[status]} className="ds-root">
      {LABELS[status]}
    </Badge>
  );
}
