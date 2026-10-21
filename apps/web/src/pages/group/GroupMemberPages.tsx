import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Icon, StatusChip, SubjectCover } from "../../ui";
import { Ava, Crumbs, useSem } from "../../components/group/common";
import { useGroupCtx } from "../../lib/groupCtx";
import { useGroupData } from "../../hooks/useGroupData";
import { pluralRu } from "../../lib/format";
import { requestAccess, subjectsOf } from "../../services/groupApi";
import { useAuth } from "../../hooks/useAuth";
import { isLectureNew } from "../../lib/notifyCtx";

const lec = (n: number) => `${n} ${pluralRu(n, ["лекция", "лекции", "лекций"])}`;

/** Одногруппник (Screen-group-member): его предметы списком, «открыто тебе» у тех, где есть доступ. */
export function GroupMemberPage() {
  const sem = useSem();
  const { userId = "" } = useParams();
  const { current } = useGroupCtx();
  const data = useGroupData();
  const person = data.roster.find((p) => p.id === userId);
  const subjects = useMemo(() => subjectsOf(data.previews, data.shares, userId), [data.previews, data.shares, userId]);
  const total = subjects.reduce((n, s) => n + s.lectures.length, 0);
  const opened = subjects.reduce((n, s) => n + s.openedToMe, 0);

  if (!data.loading && !person) {
    return <p className="c-gr-hint">Этого человека нет в группе.</p>;
  }
  return (
    <div className="c-gr-page">
      <Crumbs items={[{ label: current!.group.name, to: `/s/${sem}/group` }, { label: person?.name ?? "" }]} />
      <header className="c-gr-profile">
        {person && <Ava id={person.id} name={person.name} avatar={person.avatar} size="lg" />}
        <div className="nm">
          <h1>{person?.name ?? ""}</h1>
          <div className="meta">
            {person && <StatusChip tone={person.previewEnabled ? "ok" : "neutral"}>{person.previewEnabled ? "Предпросмотр открыт" : "Предпросмотр закрыт"}</StatusChip>}
            {person?.previewEnabled && (
              <span>
                {lec(total)} · {subjects.length} {pluralRu(subjects.length, ["предмет", "предмета", "предметов"])}
                {opened > 0 ? ` · тебе открыто ${opened}` : ""}
              </span>
            )}
          </div>
        </div>
      </header>
      {subjects.length === 0 && !data.loading ? (
        <p className="c-gr-hint">Здесь пока нечего показать: {person?.name ?? "этот человек"} не открыл предпросмотр.</p>
      ) : (
        <ul className="c-gr-list">
          {subjects.map((s) => (
            <li key={s.key}>
              <Link className="c-gr-row" to={`/s/${sem}/group/people/${userId}/${s.key}`}>
                <SubjectCover seed={s.coverSeed} size={40} />
                <span className="tx">
                  <span className="t">{s.title}</span>
                  <span className="m">{lec(s.lectures.length)}</span>
                </span>
                <span className="end">
                  {s.openedToMe > 0 && (
                    <StatusChip tone="ok">
                      {s.openedToMe} {pluralRu(s.openedToMe, ["открыта", "открыты", "открыты"])} тебе
                    </StatusChip>
                  )}
                  <Icon name="chev" size={18} className="chev" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Предмет одногруппника (Screen-group-thumbnails): список его лекций, не сетка. У закрытых «Запросить доступ»,
 * у открытых тебе — переход к чтению. Видны только названия: текст закрыт, пока автор не откроет доступ.
 */
export function GroupMemberSubjectPage() {
  const sem = useSem();
  const { userId = "", courseKey = "" } = useParams();
  const { current } = useGroupCtx();
  const { user } = useAuth();
  const data = useGroupData();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const person = data.roster.find((p) => p.id === userId);
  const subject = useMemo(() => subjectsOf(data.previews, data.shares, userId).find((s) => s.key === courseKey), [data.previews, data.shares, userId, courseKey]);
  const open = new Set(data.shares.filter((s) => s.grantee === user?.id && !s.suspended).map((s) => s.lecture));
  const sent = new Set(data.requests.filter((r) => r.requester === user?.id && r.status === "open").map((r) => r.lecture));

  const ask = async (lecture: string) => {
    setBusy(lecture);
    setError("");
    try {
      await requestAccess(lecture);
      await data.refetch();
    } catch {
      setError("Не удалось отправить запрос. Попробуй ещё раз.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="c-gr-page">
      <Crumbs
        items={[
          { label: current!.group.name, to: `/s/${sem}/group` },
          { label: person?.name ?? "", to: `/s/${sem}/group/people/${userId}` },
          { label: subject?.title ?? "" },
        ]}
      />
      <header className="c-gr-head">
        <div className="tx">
          <h1>{subject?.title ?? ""}</h1>
          <span className="sub">
            Предмет {person?.name ?? ""} · {lec(subject?.lectures.length ?? 0)}
          </span>
        </div>
      </header>
      {error ? <p className="c-gr-error">{error}</p> : null}
      <ul className="c-gr-list">
        {(subject?.lectures ?? []).map((l) => {
          const isOpen = open.has(l.lecture);
          const isSent = sent.has(l.lecture);
          const row = (
            <>
              <span className="c-gr-doc" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="tx">
                <span className="t">{l.title || "Без названия"}</span>
                <span className="m">{subject?.title}</span>
              </span>
              <span className="end">
                {isOpen ? (
                  <>
                    {data.shares.some((x) => x.lecture === l.lecture && x.grantee === user?.id && isLectureNew(l.lecture, x.created)) ? (
                      <span className="c-gr-new">
                        <i />
                        Новое
                      </span>
                    ) : (
                      <StatusChip tone="ok">Открыта тебе</StatusChip>
                    )}
                    <Icon name="chev" size={18} className="chev" />
                  </>
                ) : isSent ? (
                  <StatusChip>Запрос отправлен</StatusChip>
                ) : (
                  <Button variant="secondary" size="sm" loading={busy === l.lecture} onClick={() => void ask(l.lecture)}>
                    Запросить доступ
                  </Button>
                )}
              </span>
            </>
          );
          return (
            <li key={l.id}>
              {isOpen ? (
                <Link className="c-gr-row" to={`/s/${sem}/group/lecture/${l.lecture}`}>
                  {row}
                </Link>
              ) : (
                <div className="c-gr-row">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
