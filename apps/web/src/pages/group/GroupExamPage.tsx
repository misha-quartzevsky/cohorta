import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, EmptyState, FormDialog, Icon, Input, Popover, StatusChip, Toggletip } from "../../ui";
import { Ava, Crumbs, useSem } from "../../components/group/common";
import SubgroupFormDialog from "../../components/forms/SubgroupFormDialog";
import { useGroupCtx } from "../../lib/groupCtx";
import { useAuth } from "../../hooks/useAuth";
import { errorMessage, pluralRu } from "../../lib/format";
import { examWhen } from "../../lib/groupExamText";
import { fetchRosterPeople, ruDate, type RosterPerson } from "../../services/groupApi";
import {
  addSubgroupTicket,
  distributeTickets,
  fetchGroupExamInfo,
  fetchMySubgroup,
  fetchSubgroupTickets,
  inviteToSubgroup,
  type GroupExamInfo,
  type SubgroupInfo,
} from "../../services/groupExamApi";
import type { ExamTicket, TicketStatus } from "../../lib/types";
import { ticketNumber, ticketQuestion, ticketStatus } from "../../lib/types";

const STATUS_LABEL: Record<TicketStatus, string> = { ready: "Готов", draft: "В работе", empty: "Не начат" };
const STATUS_TONE: Record<TicketStatus, "ok" | "accent" | "neutral"> = { ready: "ok", draft: "accent", empty: "neutral" };

/**
 * Экзамен группы (Screen-group-exam): моя подгруппа, её состав, карта и список билетов.
 * Подгруппу видят только её участники: чужих подгрупп, их числа и названий здесь нет
 * (в макете вкладки «Девчонки / Дима и Игорь» — у человека, который видит все; по правилам сервера так нельзя).
 */
export default function GroupExamPage() {
  const sem = useSem();
  const navigate = useNavigate();
  const { examId = "" } = useParams();
  const { current } = useGroupCtx();
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const g = current!;

  const [info, setInfo] = useState<GroupExamInfo | null>(null);
  const [roster, setRoster] = useState<RosterPerson[]>([]);
  const [sub, setSub] = useState<SubgroupInfo | null>(null);
  const [tickets, setTickets] = useState<ExamTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [invite, setInvite] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [i, r] = await Promise.all([fetchGroupExamInfo(examId), fetchRosterPeople(g.group.id)]);
      setInfo(i);
      setRoster(r);
      if (i.exam.mySubgroup) {
        const [s, t] = await Promise.all([fetchMySubgroup(i.exam.mySubgroup.id), fetchSubgroupTickets(i.exam.mySubgroup.id)]);
        setSub(s);
        setTickets(t);
      } else {
        setSub(null);
        setTickets([]);
      }
      setError("");
    } catch (e) {
      if ((e as { status?: number }).status === 404) setMissing(true);
      else setError("Не удалось загрузить экзамен. Проверь связь и попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }, [examId, g.group.id]);

  useEffect(() => {
    setLoading(true);
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const nameOf = (id: string) => roster.find((p) => p.id === id);
  const candidates = useMemo(
    () => roster.filter((p) => p.id !== myId && !(info?.taken ?? []).includes(p.id)),
    [roster, myId, info]
  );

  if (missing) {
    return (
      <div className="c-gr-page">
        <EmptyState
          icon="exam"
          title="Экзамен не найден"
          description="Возможно, его нет в этой группе."
          action={
            <Link className="c-btn secondary" to={`/s/${sem}/group/exams`}>
              К экзаменам группы
            </Link>
          }
        />
      </div>
    );
  }
  if (loading || !info) return null;

  const exam = info.exam;
  const ticketHref = (n: number) => `/s/${sem}/group/exams/${exam.id}/ticket/${n}`;

  const act = async (fn: () => Promise<unknown>, fail: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(`${fail} ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const hint = (
    <Toggletip label="Как устроены подгруппы" align="right">
      <strong>Как устроены подгруппы</strong>
      <br />
      Экзамен общий, но готовиться можно в разных кругах. Подгруппу видят только её участники: остальные в группе не знают, кто и как готовится.
      Билеты внутри подгруппы пишут вместе, у каждого видно, кто над ним работает.
    </Toggletip>
  );

  const ready = tickets.filter((t) => ticketStatus(t) === "ready").length;

  return (
    <div className="c-gr-page">
      <Crumbs
        items={[
          { label: g.group.name, to: `/s/${sem}/group` },
          { label: "Экзамены группы", to: `/s/${sem}/group/exams` },
          { label: exam.title || "Экзамен" },
        ]}
      />
      <header className="c-gr-head">
        <div className="tx">
          <h1>Экзамен · {exam.title || "Без названия"}</h1>
          <span className="sub">
            {g.group.name} · {examWhen(exam.examDate, ruDate)}
          </span>
        </div>
        <div className="acts">{hint}</div>
      </header>
      {error ? <p className="c-gr-error">{error}</p> : null}

      {!sub ? (
        <EmptyState
          icon="people"
          title="Ты пока не в подгруппе"
          description="Подгруппа готовится к экзамену вместе: у неё свой список билетов и ответы, которые видят только её участники. Создай подгруппу или попроси участника пригласить тебя."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} />
              Новая подгруппа
            </Button>
          }
        />
      ) : (
        <>
          <div className="c-gx-tabs">
            <span className="c-gx-pill on">{sub.name}</span>
          </div>

          <section className="c-exam-card c-gx-people">
            {sub.members.map((id) => {
              const p = nameOf(id);
              const mine = id === myId;
              return (
                <span key={id} className="c-gx-person">
                  <Ava id={id} name={p?.name ?? ""} avatar={p?.avatar} size="sm" />
                  <span className="tx">
                    <span className="t">{mine ? `${p?.name ?? "Ты"}` : (p?.name ?? "Участник")}</span>
                    {(mine || id === sub.createdBy) && <span className="m">{mine ? "Ты" : "Создатель подгруппы"}</span>}
                  </span>
                </span>
              );
            })}
            <Popover
              open={invite}
              onClose={() => setInvite(false)}
              className="c-gx-invite-pop"
              trigger={
                <button type="button" className="c-gx-invite" aria-haspopup="dialog" aria-expanded={invite} onClick={() => setInvite((v) => !v)}>
                  <Icon name="plus" size={16} />
                  Пригласить в подгруппу
                </button>
              }
            >
              <div className="c-gx-invite-list">
                {candidates.length === 0 && <p className="c-gr-hint">Все участники группы уже в подгруппах.</p>}
                {candidates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="c-gr-switch-row"
                    disabled={busy}
                    onClick={() => {
                      setInvite(false);
                      void act(() => inviteToSubgroup(sub.id, p.id), "Не удалось пригласить.");
                    }}
                  >
                    <Ava id={p.id} name={p.name} avatar={p.avatar} size="xs" />
                    <span className="tx">
                      <span className="name">{p.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Popover>
          </section>

          <section className="c-exam-card c-gx-map">
            <div className="c-exam-card-head">
              <h2>Карта билетов</h2>
              <span className="meta">
                {tickets.length} {pluralRu(tickets.length, ["билет", "билета", "билетов"])}
                {tickets.length > 0 ? ` · готово ${ready}` : ""}
              </span>
            </div>
            <div className="c-gx-map-body">
              <div className="c-exam-map-grid">
                {tickets.map((t) => (
                  <Link
                    key={t.id}
                    to={ticketHref(ticketNumber(t))}
                    className={`c-exam-chip${ticketStatus(t) === "empty" ? "" : ` ${ticketStatus(t)}`}`}
                    aria-label={`Билет ${ticketNumber(t)}: ${STATUS_LABEL[ticketStatus(t)]}`}
                  >
                    {ticketNumber(t)}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="c-exam-card">
            <div className="c-exam-card-head c-gx-thead">
              <h2>Билеты</h2>
              <div className="actions">
                <Button variant="ghost" disabled={busy || tickets.length === 0} onClick={() => void act(() => distributeTickets(sub.id), "Не удалось распределить.")}>
                  Распределить поровну
                </Button>
                <Button variant="secondary" onClick={() => setAdding(true)}>
                  <Icon name="plus" size={18} />
                  Добавить билет
                </Button>
              </div>
            </div>
            {tickets.length === 0 && <p className="c-gr-hint c-gx-empty">Билетов пока нет. Добавь первый.</p>}
            {tickets.map((t) => {
              const n = ticketNumber(t);
              const st = ticketStatus(t);
              const who = (t.assignees ?? []).map((id) => nameOf(id)).filter(Boolean) as RosterPerson[];
              return (
                <Link key={t.id} to={ticketHref(n)} className="c-exam-ticket-row">
                  <span className="c-exam-ticket-num">{n}</span>
                  <span className="c-exam-ticket-tx">
                    <span className="t">{ticketQuestion(t)}</span>
                  </span>
                  {who.length === 0 ? (
                    <span className="c-gx-nobody">Никто не взял</span>
                  ) : (
                    <span className="c-gx-stack" aria-label={`Взяли: ${who.map((p) => p.name).join(", ")}`}>
                      {who.map((p) => (
                        <Ava key={p.id} id={p.id} name={p.name} avatar={p.avatar} size="xs" />
                      ))}
                    </span>
                  )}
                  <StatusChip tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</StatusChip>
                </Link>
              );
            })}
          </section>
        </>
      )}

      <SubgroupFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        examId={exam.id}
        examTitle={exam.title}
        roster={roster}
        myId={myId}
        taken={info.taken}
        onCreated={() => {
          void load();
          navigate(`/s/${sem}/group/exams/${exam.id}`, { replace: true });
        }}
      />
      {sub && (
        <AddTicketDialog
          open={adding}
          onClose={() => setAdding(false)}
          onAdd={async (q) => {
            await addSubgroupTicket(sub.id, q);
            await load();
          }}
        />
      )}
    </div>
  );
}

function AddTicketDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (question: string) => Promise<void> }) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setQuestion("");
      setError("");
    }
  }, [open]);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Добавить билет"
      subtitle="Билет появится в списке подгруппы. Ответ напишете вместе."
      submitLabel="Добавить"
      onSubmit={async () => {
        if (!question.trim()) {
          setError("Введи вопрос билета");
          return false;
        }
        try {
          await onAdd(question);
        } catch (e) {
          setError("Не удалось добавить: " + errorMessage(e));
          return false;
        }
      }}
    >
      <Input
        label="Вопрос"
        value={question}
        error={error || undefined}
        onChange={(e) => {
          setQuestion(e.target.value);
          setError("");
        }}
        autoFocus
      />
    </FormDialog>
  );
}
