/**
 * «С чего начать» — пустое состояние Главной (States-empty, блок «Главная,
 * новый пользователь»). Три шага; выполненный шаг исчезает, когда выполнены
 * все — исчезает карточка. Единственная оранжевая кнопка — «Начать».
 */

import { Button } from "../../ui";
import { openStartSteps } from "../../lib/lectureListRules";

export interface StartStepsState {
  hasSubjects: boolean;
  hasPairs: boolean;
  hasLectures: boolean;
}

interface Step {
  key: "subjects" | "pairs" | "lecture";
  title: string;
  hint: string;
  action: string;
  primary: boolean;
  done: boolean;
  onClick: () => void;
}

interface Props extends StartStepsState {
  onAddSubject: () => void;
  onAddPairs: () => void;
  onStartNote: () => void;
}

export default function StartCard({
  hasSubjects,
  hasPairs,
  hasLectures,
  onAddSubject,
  onAddPairs,
  onStartNote,
}: Props) {
  const steps: Step[] = [
    {
      key: "subjects",
      title: "Добавь предметы",
      hint: "Название и обложка",
      action: "Добавить",
      primary: false,
      done: hasSubjects,
      onClick: onAddSubject,
    },
    {
      key: "pairs",
      title: "Добавь пары",
      hint: "Лекции будут создаваться по расписанию",
      action: "Добавить",
      primary: false,
      done: hasPairs,
      onClick: onAddPairs,
    },
    {
      key: "lecture",
      title: "Напиши первый конспект",
      hint: "Можно прямо сейчас",
      action: "Начать",
      primary: true,
      done: hasLectures,
      onClick: onStartNote,
    },
  ];
  const openKeys = openStartSteps({ hasSubjects, hasPairs, hasLectures });
  const open = steps.filter((s) => openKeys.includes(s.key));
  if (open.length === 0) return null;

  // Номера остаются теми же, что в макете (1, 2, 3), даже если шаг выше выполнен.
  return (
    <section className="c-start" aria-labelledby="c-start-title">
      <div className="c-start-head">
        <h2 id="c-start-title">С чего начать</h2>
        {open.length === 3 && <span>Три шага, остальное появится само</span>}
      </div>
      {open.map((step) => (
        <div key={step.key} className="c-start-step">
          <span className="n" aria-hidden="true">
            {steps.indexOf(step) + 1}
          </span>
          <div className="tx">
            <span className="t">{step.title}</span>
            <span className="m">{step.hint}</span>
          </div>
          <Button size="sm" variant={step.primary ? "primary" : "secondary"} onClick={step.onClick}>
            {step.action}
          </Button>
        </div>
      ))}
    </section>
  );
}
