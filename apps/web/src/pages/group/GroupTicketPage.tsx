import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, EmptyState, Icon, Modal, StatusChip } from "../../ui";
import Editor from "../../components/Editor";
import LecturePickerDialog from "../../components/exam/LecturePickerDialog";
import { Ava, Crumbs, useSem } from "../../components/group/common";
import { useGroupCtx } from "../../lib/groupCtx";
import { useMode } from "../../lib/modeContext";
import { useAuth } from "../../hooks/useAuth";
import { errorMessage, parsePbDate } from "../../lib/format";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { resolveFileTokensFor, tokenizeFileUrlsFor } from "../../lib/fileTokens";
import { statusForAnswer, uploadTicketImages, updateTicket, fetchLecturesOpenedToMe } from "../../services/examService";
import { fetchOpenedMeta, fetchRosterPeople, type OpenedMeta, type RosterPerson } from "../../services/groupApi";
import {
  fetchGroupExamInfo,
  fetchMyLecturesForPicker,
  fetchSubgroupTickets,
  fetchVisibleLectures,
  findMyAnswerSource,
  lockTicket,
  takeMyAnswer,
  unlockTicket,
  type GroupExamInfo,
} from "../../services/groupExamApi";
import type { ExamTicket, Lecture, TicketStatus } from "../../lib/types";
import { courseName, lectureTitle, ticketAnswer, ticketNumber, ticketQuestion, ticketSourceIds, ticketStatus } from "../../lib/types";

const STATUS_LABEL: Record<TicketStatus, string> = { ready: "Готов", draft: "В работе", empty: "Не начат" };
const STATUS_TONE: Record<TicketStatus, "ok" | "accent" | "neutral"> = { ready: "ok", draft: "accent", empty: "neutral" };

/** Сколько миллисекунд ещё держится блокировка (0 — свободен или держу я). */
function busyLeft(t: ExamTicket, myId: string, now: number): number {
  if (!t.locked_by || t.locked_by === myId || !t.locked_until) return 0;
  const until = parsePbDate(String(t.locked_until))?.getTime();
  return until === undefined ? 0 : Math.max(0, until - now);
}

function plainStart(html: string, max = 60): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Билет подгруппы (Screen-ticket-group, Screen-m-ticket-group): тот же экран билета, что в Соло, плюс подгруппа,
 * блокировка правки («Занят», 30 секунд без действий), «Взять мой ответ» и защищённый просмотр.
 * Защищённый просмотр включается, когда режим «Группа» не выбран: без правки и копирования
 * (защита от случайного, не абсолютная).
 */
export default function GroupTicketPage() {
  const sem = useSem();
  const { examId = "", number = "" } = useParams();
  const { current } = useGroupCtx();
  const { isGroup } = useMode();
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const protectedView = !isGroup;

  const [info, setInfo] = useState<GroupExamInfo | null>(null);
  const [roster, setRoster] = useState<RosterPerson[]>([]);
  const [ticket, setTicket] = useState<ExamTicket | null>(null);
  const [missing, setMissing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<{ id: string; answer: string } | null>(null);
  const [takeOpen, setTakeOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [mine, setMine] = useState<Lecture[]>([]);
  const [opened, setOpened] = useState<Lecture[]>([]);
  const [meta, setMeta] = useState<Record<string, OpenedMeta>>({});
  const [linked, setLinked] = useState<Lecture[]>([]);

  const ticketRef = useRef<ExamTicket | null>(null);
  const contentRef = useRef("");
  const lastTypedAt = useRef(0);
  const modeRef = useRef<"view" | "edit">("view");
  modeRef.current = mode;

  const load = useCallback(async () => {
    try {
      const i = await fetchGroupExamInfo(examId);
      setInfo(i);
      const sid = i.exam.mySubgroup?.id;
      if (!sid) {
        setMissing(true);
        return;
      }
      const rows = await fetchSubgroupTickets(sid);
      const t = rows.find((x) => ticketNumber(x) === Number(number)) ?? null;
      if (!t) {
        setMissing(true);
        return;
      }
      setTicket(t);
      ticketRef.current = t;
      // пока я правлю, чужие обновления не должны затирать мой текст
      if (modeRef.current === "view") {
        const c = resolveFileTokensFor(ticketAnswer(t), t);
        contentRef.current = c;
        setContent(c);
      }
    } catch (e) {
      if ((e as { status?: number }).status === 404) setMissing(true);
      else setError("Не удалось загрузить билет. Проверь связь и попробуй ещё раз.");
    }
  }, [examId, number]);

  useEffect(() => {
    void load();
    fetchRosterPeople(current?.group.id ?? "").then(setRoster).catch(() => undefined);
  }, [load, current?.group.id]);

  // пока билет открыт на просмотр, раз в 5 секунд смотрим, не освободился ли он и не изменили ли его
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (modeRef.current === "view") void load();
    }, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  // мой личный ответ того же предмета с тем же номером
  useEffect(() => {
    if (!info || !ticket || protectedView) return;
    findMyAnswerSource(info.exam.title, ticketNumber(ticket)).then(setSource).catch(() => setSource(null));
  }, [info, ticket, protectedView]);

  // связанные лекции и данные для окна привязки
  const sourceKey = ticket ? ticketSourceIds(ticket).join(",") : "";
  useEffect(() => {
    if (!ticket) return;
    const ids = ticketSourceIds(ticket);
    fetchVisibleLectures(ids)
      .then(async (rows) => {
        setLinked(rows);
        const foreign = rows.filter((l) => l.owner && l.owner !== myId);
        const extra = await fetchOpenedMeta(foreign).catch(() => ({}));
        setMeta((m) => ({ ...m, ...extra }));
      })
      .catch(() => setLinked([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, myId]);

  const openPicker = async () => {
    setPickOpen(true);
    try {
      const [m, o] = await Promise.all([fetchMyLecturesForPicker(), fetchLecturesOpenedToMe()]);
      setMine(m);
      setOpened(o);
      const extra = await fetchOpenedMeta(o).catch(() => ({}));
      setMeta((cur) => ({ ...cur, ...extra }));
    } catch {
      setError("Не удалось загрузить лекции.");
    }
  };

  // блокировка: пока человек печатает, держим её (сервер снимает через 30 секунд без действий)
  useEffect(() => {
    if (mode !== "edit") return;
    const id = window.setInterval(() => {
      const t = ticketRef.current;
      if (t && Date.now() - lastTypedAt.current < 30_000) void lockTicket(t.id).catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [mode]);

  // выход со страницы отпускает билет
  useEffect(
    () => () => {
      const t = ticketRef.current;
      if (modeRef.current === "edit" && t) void unlockTicket(t.id).catch(() => undefined);
    },
    []
  );

  const left = ticket ? busyLeft(ticket, myId, now) : 0;
  const holder = ticket ? roster.find((p) => p.id === ticket.locked_by) : undefined;
  const busy = left > 0 && !protectedView;

  const startEdit = async () => {
    if (!ticket) return;
    setError("");
    try {
      const r = await lockTicket(ticket.id);
      if (!r.ok) {
        await load();
        setNow(Date.now());
        return;
      }
      lastTypedAt.current = Date.now();
      setMode("edit");
    } catch (e) {
      setError(`Не удалось начать правку. ${errorMessage(e)}`);
    }
  };

  const finish = async (save: boolean) => {
    const t = ticketRef.current;
    if (!t) return;
    setSaving(true);
    setError("");
    try {
      if (save) {
        const next = statusForAnswer(contentRef.current, ticketStatus(t));
        await updateTicket(t.id, { answer: tokenizeFileUrlsFor(contentRef.current, t, "exam_tickets"), status: next });
      }
      await unlockTicket(t.id).catch(() => undefined);
      setMode("view");
      modeRef.current = "view";
      await load();
    } catch (e) {
      const busyNow = (e as { status?: number }).status === 409;
      setError(busyNow ? "Билет занят: его сейчас правит другой участник. Твой текст остался в окне, скопируй его и попробуй позже." : `Не удалось сохранить. ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const take = async () => {
    if (!ticket || !source) return;
    setSaving(true);
    setError("");
    try {
      const r = await takeMyAnswer(ticket.id, source.id);
      setTakeOpen(false);
      if (!r.ok) setError("Билет занят: его сейчас правит другой участник.");
      await load();
    } catch (e) {
      setError(`Не удалось взять ответ. ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSources = async (ids: string[]) => {
    if (!ticket) return;
    try {
      await updateTicket(ticket.id, { sources: ids });
      await load();
    } catch (e) {
      setError(`Не удалось привязать лекции. ${errorMessage(e)}`);
    }
  };

  const sourceRows = useMemo(() => {
    const ids = ticket ? ticketSourceIds(ticket) : [];
    return ids.map((id) => ({ id, lecture: linked.find((l) => l.id === id) }));
  }, [ticket, linked]);

  const base = `/s/${sem}/group/exams/${examId}`;
  if (missing) {
    return (
      <div className="c-gr-page">
        <EmptyState
          icon="exam"
          title="Билет не найден"
          description="Билеты подгруппы видят только её участники."
          action={
            <Link className="c-btn secondary" to={`/s/${sem}/group/exams`}>
              К экзаменам группы
            </Link>
          }
        />
      </div>
    );
  }
  if (!info || !ticket) return null;

  const st = ticketStatus(ticket);
  const sg = info.exam.mySubgroup!;
  const html = sanitizeHtml(content);
  const guard = protectedView
    ? {
        onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
        onCut: (e: React.ClipboardEvent) => e.preventDefault(),
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        onDragStart: (e: React.DragEvent) => e.preventDefault(),
      }
    : {};

  return (
    <div className={`c-gr-page c-gx-ticket${mode === "edit" ? " editing" : ""}`}>
      <Crumbs
        items={[
          { label: current?.group.name ?? "", to: `/s/${sem}/group` },
          { label: "Экзамены группы", to: `/s/${sem}/group/exams` },
          { label: info.exam.title || "Экзамен", to: base },
          { label: `Билет ${ticketNumber(ticket)}` },
        ]}
      />
      <Link className="c-gx-back" to={base}>
        <Icon name="chev" size={18} className="c-gx-back-ic" />
        Экзамен
      </Link>

      <section className="c-exam-card c-gx-card">
        <div className="c-gx-chips">
          <span className="c-gx-chip">Подгруппа «{sg.name}»</span>
          <StatusChip tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</StatusChip>
        </div>
        <h1 className="c-gx-h">
          <span className="c-gx-title-d">
            Билет {ticketNumber(ticket)} · {ticketQuestion(ticket)}
          </span>
          <span className="c-gx-title-m">Билет {ticketNumber(ticket)}</span>
        </h1>
        <p className="c-gx-sub-m">{sg.name}</p>
        <p className="c-gx-q-m">{ticketQuestion(ticket)}</p>

        {protectedView && (
          <div className="c-gx-banner mute">
            <Icon name="lock" size={16} />
            <span>Защищённый просмотр. Билет чужой подгруппы нельзя править и копировать.</span>
          </div>
        )}
        {busy && (
          <div className="c-gx-banner warn" role="status">
            <Ava id={ticket.locked_by ?? ""} name={holder?.name ?? ""} avatar={holder?.avatar} size="xs" />
            <span>{holder?.name ?? "Участник"} редактирует этот билет. Откроется, когда закончит или через 30 секунд без действий.</span>
          </div>
        )}
        {mode === "edit" && (
          <div className="c-gx-banner edit" role="status">
            <Icon name="alert" size={16} />
            <span>Правка идёт. Остальные видят билет, но менять не могут. Блокировка снимается через 30 секунд без действий.</span>
          </div>
        )}
        {error ? <p className="c-gr-error">{error}</p> : null}

        {mode === "edit" ? (
          <div className="c-gx-answer edit">
            <Editor
              key={ticket.id}
              value={content}
              onUpdate={(v) => {
                contentRef.current = v;
                lastTypedAt.current = Date.now();
                setContent(v);
              }}
              className="editor-inline"
              placeholder="Пиши ответ…"
              onUploadImages={(files) => uploadTicketImages(ticket, files)}
            />
          </div>
        ) : (
          <div
            className={`c-gx-answer${busy ? " busy" : ""}${protectedView ? " protected" : ""}`}
            {...guard}
            dangerouslySetInnerHTML={{ __html: html || "<p>Ответа пока нет.</p>" }}
          />
        )}

        <div className="c-gx-sources">
          {sourceRows.map(({ id, lecture }) => (
            <span key={id} className="c-gx-source">
              <Icon name="link" size={14} />
              {lecture
                ? [meta[id]?.ownerName && lecture.owner !== myId ? meta[id].ownerName : "", lecture.number ? `Лекция ${lecture.number}` : lectureTitle(lecture)]
                    .filter(Boolean)
                    .join(" · ") + (lecture.expand?.field ? ` · ${courseName(lecture.expand.field)}` : meta[id]?.courseTitle ? ` · ${meta[id].courseTitle}` : "")
                : "Лекция недоступна"}
            </span>
          ))}
          {!protectedView && (
            <button type="button" className="c-gx-link-btn" onClick={() => void openPicker()}>
              <Icon name="plus" size={14} />
              Привязать лекцию
            </button>
          )}
        </div>

        {!protectedView && (
          <div className="c-gx-actions">
            {mode === "edit" ? (
              <>
                <Button variant="ghost" disabled={saving} onClick={() => void finish(false)}>
                  Отмена
                </Button>
                <Button variant="primary" loading={saving} onClick={() => void finish(true)}>
                  Сохранить
                </Button>
              </>
            ) : (
              <>
                {source && (
                  <Button variant="secondary" disabled={busy} onClick={() => setTakeOpen(true)}>
                    Взять мой ответ
                  </Button>
                )}
                <Button variant="primary" disabled={busy} onClick={() => void startEdit()}>
                  Редактировать
                </Button>
              </>
            )}
          </div>
        )}
      </section>

      <Modal
        open={takeOpen}
        onClose={() => setTakeOpen(false)}
        title="Взять мой ответ?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTakeOpen(false)}>
              Отмена
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void take()}>
              Взять мой ответ
            </Button>
          </>
        }
      >
        <p className="c-gx-take-p">Твой ответ из личного экзамена попадёт в билет подгруппы. Текущий текст билета заменится.</p>
        <p className="c-gx-take-quote">Твой ответ: «{plainStart(source?.answer ?? "")}»</p>
      </Modal>

      <LecturePickerDialog
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        ticketNumber={ticketNumber(ticket)}
        mine={mine}
        course={null}
        opened={opened}
        openedMeta={meta}
        selectedIds={ticketSourceIds(ticket)}
        onSave={saveSources}
      />
    </div>
  );
}
