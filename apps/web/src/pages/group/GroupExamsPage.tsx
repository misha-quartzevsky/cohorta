import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, EmptyState, Icon, StatusChip, SubjectCover } from "../../ui";
import { Crumbs, useSem } from "../../components/group/common";
import GroupExamFormDialog from "../../components/forms/GroupExamFormDialog";
import { useGroupCtx } from "../../lib/groupCtx";
import { useForms } from "../../lib/formsContext";
import { useGroupExams } from "../../hooks/useGroupExams";
import { useUiShell } from "../../lib/uiShellContext";
import { useNotify } from "../../lib/notifyCtx";
import { pluralRu } from "../../lib/format";
import { daysLabel, daysUntil } from "../../lib/groupExamText";
import { ruDate } from "../../services/groupApi";

function examsLabel(n: number): string {
  return `${n} ${pluralRu(n, ["экзамен", "экзамена", "экзаменов"])}`;
}

/**
 * Экзамены группы (Screen-group-exams, Screen-m-group-exams): список экзаменов, у каждого моя подгруппа.
 * Чужие подгруппы человек не видит, поэтому числа подгрупп нет: только «Ты в «…»» или «Не в подгруппе».
 * Лампочки из макета нет: её текст на этом экране не нарисован.
 */
export default function GroupExamsPage() {
  const sem = useSem();
  const { current } = useGroupCtx();
  const forms = useForms();
  const { openSearch } = useUiShell();
  const { markSeen } = useNotify();
  useEffect(() => markSeen("exams"), [markSeen]);
  const g = current!;
  const { exams, loading, error } = useGroupExams(g.group.id);
  const [creating, setCreating] = useState(false);

  return (
    <div className="c-gr-page">
      <Crumbs items={[{ label: g.group.name, to: `/s/${sem}/group` }, { label: "Экзамены группы" }]} />
      <header className="c-gr-head">
        <div className="tx">
          <h1>
            <span className="c-gx-title-d">Экзамены группы</span>
            <span className="c-gx-title-m">Экзамены</span>
          </h1>
          <span className="sub">
            {g.group.name} · {examsLabel(exams.length)}
          </span>
        </div>
        <div className="acts">
          <Button variant="primary" className="c-gx-create-d" onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} />
            Создать экзамен
          </Button>
          <button type="button" className="c-gr-search-m" aria-label="Поиск" onClick={openSearch}>
            <Icon name="search" size={22} />
          </button>
        </div>
      </header>
      {error ? <p className="c-gr-error">{error}</p> : null}

      {!loading && exams.length === 0 && !error ? (
        <EmptyState
          icon="exam"
          title="Экзаменов группы пока нет"
          description="Создай экзамен, и в группе появится общий список билетов. Подгруппы создаются внутри экзамена."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Создать экзамен
            </Button>
          }
        />
      ) : (
        <ul className="c-gr-list">
          {exams.map((x) => (
            <li key={x.id}>
              <Link className="c-gr-row c-gx-row" to={`/s/${sem}/group/exams/${x.id}`}>
                <SubjectCover seed={x.coverSeed} size={40} />
                <span className="tx">
                  <span className="t">{x.title || "Экзамен"}</span>
                  <span className="m">
                    {daysUntil(x.examDate) === null ? (
                      "Дата не задана"
                    ) : (
                      <>
                        {ruDate(x.examDate)}
                        <span className="c-gx-days"> · {daysLabel(daysUntil(x.examDate) ?? 0)}</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="end">
                  {x.mySubgroup ? (
                    <StatusChip tone="accent">Ты в «{x.mySubgroup.name}»</StatusChip>
                  ) : (
                    <StatusChip>Не в подгруппе</StatusChip>
                  )}
                  <Icon name="chev" size={18} className="chev" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {exams.length > 0 && (
        <Button variant="secondary" className="c-gx-create-m" onClick={() => setCreating(true)}>
          Создать экзамен
        </Button>
      )}
      <GroupExamFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        groupId={g.group.id}
        semSlug={sem}
        onAddSubject={() => forms?.openSubjectForm()}
      />
    </div>
  );
}
