import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { EmptyState } from "../../ui";
import ImportScreen from "../../components/exam/ImportScreen";
import { useSem } from "../../components/group/common";
import { useGroupCtx } from "../../lib/groupCtx";
import { examDateLabel } from "../../lib/groupExamText";
import { ticketNumber } from "../../lib/types";
import { fetchGroupExamInfo, fetchSubgroupTickets, importSubgroupTickets, type GroupExamInfo } from "../../services/groupExamApi";

/**
 * «Импорт билетов» экзамена группы: тот же экран, что у личного экзамена (components/exam/ImportScreen),
 * билеты попадают туда же, куда «Добавить билет» на экране экзамена, то есть в мою подгруппу.
 * Импортировать может любой участник подгруппы; кто не в подгруппе, билетов здесь не добавляет.
 */
export default function GroupExamImportPage() {
  const sem = useSem();
  const navigate = useNavigate();
  const { examId = "" } = useParams();
  const { current } = useGroupCtx();
  const [info, setInfo] = useState<GroupExamInfo | null>(null);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const i = await fetchGroupExamInfo(examId);
      setInfo(i);
      const sid = i.exam.mySubgroup?.id;
      setNumbers(sid ? (await fetchSubgroupTickets(sid)).map((t) => ticketNumber(t)) : []);
    } catch {
      setMissing(true);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  const examPath = `/s/${sem}/group/exams/${examId}`;
  const gname = current?.group.name ?? "";

  if (missing || (info && !info.exam.mySubgroup)) {
    return (
      <div className="c-gr-page">
        <EmptyState
          icon="exam"
          title={missing ? "Экзамен не найден" : "Ты пока не в подгруппе"}
          description={
            missing
              ? "Возможно, его нет в этой группе."
              : "Билеты добавляют участники подгруппы. Создай подгруппу на экране экзамена или попроси участника пригласить тебя."
          }
          action={
            <Link className="c-btn secondary" to={missing ? `/s/${sem}/group/exams` : examPath}>
              {missing ? "К экзаменам группы" : "К экзамену"}
            </Link>
          }
        />
      </div>
    );
  }
  if (!info) return null;
  const sub = info.exam.mySubgroup!;

  return (
    <ImportScreen
      crumbs={[
        { label: gname, to: `/s/${sem}/group` },
        { label: "Экзамены группы", to: `/s/${sem}/group/exams` },
        { label: info.exam.title || "Экзамен", to: examPath },
        { label: "Импорт" },
      ]}
      back={{ label: "Экзамен", to: examPath }}
      subtitle={`${info.exam.title} · ${gname} · ${examDateLabel(info.exam.examDate)}`}
      existingNumbers={numbers}
      onSubmit={async (numbered) => {
        await importSubgroupTickets(sub.id, numbered.map((t) => t.question));
      }}
      onDone={() => navigate(examPath)}
    />
  );
}
