import { useEffect, useMemo, useState } from "react";
import { Button, Icon } from "../../ui";
import { Ava, useSem } from "../../components/group/common";
import { useGroupCtx } from "../../lib/groupCtx";
import { useGroupData } from "../../hooks/useGroupData";
import { useAuth } from "../../hooks/useAuth";
import { useNotify } from "../../lib/notifyCtx";
import { useUiShell } from "../../lib/uiShellContext";
import { pb } from "../../lib/pocketbase";
import { pluralRu } from "../../lib/format";
import { groupInitials, resolveRequest, revokeShares, setGroupPreview } from "../../services/groupApi";

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="c-gr-switch" onClick={() => onChange(!on)}>
      <span className="tr" />
      <span className="d-only">Открыт</span>
    </button>
  );
}

interface Reader {
  key: string;
  name: string;
  sub: string;
  shareIds: string[];
  subgroup: boolean;
  userId?: string;
  avatar?: string;
  lectures: Set<string>;
}

/**
 * «Мой доступ» (Screen-group-access-my, Screen-m-group-access): предпросмотр для каждой группы,
 * входящие запросы и «Кому открыты лекции». Переключатель предпросмотра один на группу.
 */
export default function GroupAccessPage() {
  useSem();
  const { groups, current, refresh } = useGroupCtx();
  const { user } = useAuth();
  const { openSearch } = useUiShell();
  const data = useGroupData();
  const { markSeen } = useNotify();
  useEffect(() => markSeen("access"), [markSeen]);
  const [previews, setPreviews] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [subNames, setSubNames] = useState<Record<string, string>>({});
  const [lectureTitles, setLectureTitles] = useState<Record<string, string>>({});

  // Состояние переключателей по каждой группе: свои строки членства.
  useEffect(() => {
    let alive = true;
    pb.collection("group_members")
      .getFullList({ filter: pb.filter("user = {:u}", { u: user?.id ?? "" }), fields: "group,preview_enabled" })
      .then((rows) => {
        if (!alive) return;
        const m: Record<string, boolean> = {};
        for (const r of rows) m[String(r.group)] = r.preview_enabled === true;
        setPreviews(m);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user?.id, groups.length]);

  useEffect(() => {
    pb.collection("exam_subgroups")
      .getFullList({ fields: "id,name" })
      .then((rows) => setSubNames(Object.fromEntries(rows.map((r) => [r.id, String(r.name)]))))
      .catch(() => undefined);
  }, []);

  const myShares = data.shares.filter((s) => s.owner === user?.id);
  const openRequests = data.requests.filter((r) => r.owner === user?.id && r.status === "open");

  // Названия лекций, к которым идут запросы и доступы (мои лекции читаются напрямую).
  useEffect(() => {
    const ids = [...new Set([...myShares.map((s) => s.lecture), ...openRequests.map((r) => r.lecture)])];
    if (ids.length === 0) return;
    pb.collection("lectures")
      .getFullList({ filter: ids.map((id) => `id="${id}"`).join(" || "), fields: "id,title" })
      .then((rows) => setLectureTitles(Object.fromEntries(rows.map((r) => [r.id, String(r.title)]))))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.shares.length, data.requests.length]);

  const readers = useMemo<Reader[]>(() => {
    const byUser = new Map<string, Reader>();
    const bySub = new Map<string, Reader>();
    const title = (id: string) => lectureTitles[id] ?? "лекцию";
    for (const s of myShares) {
      if (s.subgroup) {
        const r = bySub.get(s.subgroup) ?? { key: `s${s.subgroup}`, name: `Подгруппа «${subNames[s.subgroup] ?? "…"}»`, sub: "", shareIds: [], subgroup: true, lectures: new Set() };
        r.shareIds.push(s.id);
        r.lectures.add(s.lecture);
        bySub.set(s.subgroup, r);
      } else {
        const p = data.roster.find((x) => x.id === s.grantee);
        const r = byUser.get(s.grantee) ?? { key: `u${s.grantee}`, name: p?.name ?? "Участник", sub: "", shareIds: [], subgroup: false, userId: s.grantee, avatar: p?.avatar, lectures: new Set() };
        r.shareIds.push(s.id);
        r.lectures.add(s.lecture);
        byUser.set(s.grantee, r);
      }
    }
    const all = [...byUser.values(), ...bySub.values()];
    for (const r of all) {
      const ls = [...r.lectures];
      r.sub = ls.length === 1 ? `Читает «${title(ls[0])}»` : `Читает ${ls.length} ${pluralRu(ls.length, ["лекцию", "лекции", "лекций"])}`;
    }
    return all;
  }, [myShares, data.roster, subNames, lectureTitles]);

  const toggle = async (groupId: string, on: boolean) => {
    setPreviews((p) => ({ ...p, [groupId]: on }));
    try {
      await setGroupPreview(groupId, on);
      await refresh();
    } catch {
      setPreviews((p) => ({ ...p, [groupId]: !on }));
      setError("Не удалось переключить предпросмотр. Попробуй ещё раз.");
    }
  };

  const decide = async (id: string, action: "grant" | "decline") => {
    setBusy(id);
    setError("");
    try {
      await resolveRequest(id, action);
      await data.refetch();
      await refresh();
    } catch {
      setError("Не удалось ответить на запрос. Попробуй ещё раз.");
    } finally {
      setBusy("");
    }
  };

  const remove = async (r: Reader) => {
    setBusy(r.key);
    try {
      await revokeShares(r.shareIds);
      await data.refetch();
    } catch {
      setError("Не удалось убрать доступ. Попробуй ещё раз.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="c-gr-page">
      <header className="c-gr-head">
        <div className="tx">
          <h1>Мой доступ</h1>
          <span className="sub">Кто что видит из твоих лекций</span>
        </div>
        <button type="button" className="c-gr-search-m" aria-label="Поиск" onClick={openSearch}>
          <Icon name="search" size={22} />
        </button>
      </header>
      {error ? <p className="c-gr-error">{error}</p> : null}

      <div className="c-gr-togs">
      {groups.map((g) => {
        const on = previews[g.group.id] === true;
        return (
          <section key={g.group.id} className="c-gr-toggle-card">
            <div className="tx">
              <span className="t">Предпросмотр для {g.group.name}</span>
              <span className="m d-only">{groups.length > 1 && g.group.id !== current?.group.id ? "У каждой группы свой переключатель." : on ? "Группа видит названия твоих лекций, но не текст." : "Группа видит названия твоих лекций, но не текст. Сейчас закрыт."}</span>
              <span className="m m-only">{on ? "Открыт. Видны названия, не текст" : "Закрыт. Группа не видит названия"}</span>
            </div>
            <Switch on={on} onChange={(v) => void toggle(g.group.id, v)} label={`Предпросмотр для ${g.group.name}`} />
          </section>
        );
      })}
      </div>

      <section className="c-gr-section">
        <header>
          <h2>Запросы<span className="m-only"> · {openRequests.length}</span></h2>
          {openRequests.length > 0 && (
            <span className="c-gr-new">
              <i />
              {openRequests.length} {pluralRu(openRequests.length, ["новый", "новых", "новых"])}
            </span>
          )}
        </header>
        <div className="c-gr-rows">
        {openRequests.length === 0 ? <p className="c-gr-hint" style={{ padding: "12px 0" }}>Запросов нет.</p> : null}
        {openRequests.map((r) => {
          const p = data.roster.find((x) => x.id === r.requester);
          return (
            <div key={r.id} className="c-gr-prow">
              <Ava id={r.requester} name={p?.name ?? "Участник"} avatar={p?.avatar} size="sm" />
              <div className="tx">
                <span className="t">{p?.name ?? "Участник"}</span>
                <span className="m">Просит «{lectureTitles[r.lecture] ?? "лекцию"}»</span>
              </div>
              <div className="acts">
                <Button variant="secondary" size="sm" loading={busy === r.id} onClick={() => void decide(r.id, "grant")}>
                  Открыть
                </Button>
                <button type="button" className="txt" onClick={() => void decide(r.id, "decline")} disabled={busy === r.id}>
                  Отклонить
                </button>
              </div>
            </div>
          );
        })}
        </div>
      </section>

      <section className="c-gr-section c-gr-who">
        <header>
          <h2>Кому открыты лекции</h2>
        </header>
        {readers.length === 0 ? <p className="c-gr-hint" style={{ padding: "12px 0" }}>Пока никому. Доступ к лекции открывается из меню лекции «···» → «Доступ в группе».</p> : null}
        {readers.map((r) => (
          <div key={r.key} className="c-gr-prow">
            {r.subgroup ? <span className="c-gr-ava sm">{groupInitials(r.name.replace(/^Подгруппа «|»$/g, ""))}</span> : <Ava id={r.userId ?? ""} name={r.name} avatar={r.avatar} size="sm" />}
            <div className="tx">
              <span className="t">{r.name}</span>
              <span className="m">{r.sub}</span>
            </div>
            <div className="acts">
              <Button variant="secondary" size="sm" loading={busy === r.key} onClick={() => void remove(r)}>
                <Icon name="x" size={14} /> Убрать
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
