/**
 * ============================================
 *  ModeToggle.tsx — Соло / Группа segmented switch
 * ============================================
 *
 * Живёт в сайдбаре сразу под логотипом (DESIGN.md §7.1).
 * Сегментированный тумблер из двух пилюль в общей капсуле:
 * активная залита `--surface` + тень, неактивная приглушена.
 *
 * В режиме «Соло» вся групповая механика в интерфейсе скрыта.
 * Переключение в «Группу» ведёт на экран «Моя группа»;
 * возврат в «Соло» с этого экрана — на рабочий стол.
 */

import { useNavigate, useLocation } from "react-router-dom";

import { useMode, type Mode } from "../lib/modeContext";
import { useSemester } from "../lib/semesterContext";
import { semesterSlug } from "../lib/types";
import { lastSemesterSlug } from "../lib/lastSemester";

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "solo", label: "Соло" },
  { value: "group", label: "Группа" },
];

export default function ModeToggle() {
  const { mode, setMode } = useMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { current } = useSemester();

  const semSlug = current ? semesterSlug(current) : lastSemesterSlug() || "1";

  const choose = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    if (next === "group") {
      navigate(`/s/${semSlug}/group`);
    } else if (/\/group$/.test(location.pathname)) {
      navigate(`/s/${semSlug}`);
    }
  };

  return (
    <div className="mode-toggle" role="radiogroup" aria-label="Режим">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={mode === opt.value}
          className={`mode-toggle-btn${mode === opt.value ? " active" : ""}`}
          onClick={() => choose(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
