import { useCallback, useEffect, useState } from "react";
import { Button, Icon, Modal } from "../../ui";
import { Ava } from "./common";
import { useGroupCtx } from "../../lib/groupCtx";
import { pb } from "../../lib/pocketbase";
import { errorMessage } from "../../lib/format";
import {
  fetchRequests,
  fetchRosterPeople,
  groupInitials,
  grantLecture,
  resolveRequest,
  revokeShares,
  shareWithSubgroup,
  type RequestRow,
  type RosterPerson,
  type ShareRow,
} from "../../services/groupApi";
import { fetchMySubgroup } from "../../services/groupExamApi";
import type { Lecture } from "../../lib/types";

interface Row {
  key: string;
  name: string;
  sub: boolean;
  userId?: string;
  avatar?: string;
  ids: string[];
  allowCopy: boolean;
  /** Подгруппа: id и состав («Ты и Лена»). */
  subgroup?: string;
  note?: string;
}

/**
 * «Доступ к лекции» (Screen-group-access): кто читает, добавить человека или подгруппу, запрос на доступ.
 * Открывается из меню лекции «Доступ в группе». «Можно копировать» — галочка у каждого читателя, человека и подгруппы отдельно,
 * по умолчанию выключена; хранится на выданном доступе. В списке «Добавить человека или подгруппу» своей галочки нет.
 */
export default function LectureAccessDialog({ lecture, open, onClose }: { lecture: Lecture; open: boolean; onClose: () => void }) {
  const { current } = useGroupCtx();
  const groupId = current?.group.id ?? "";
  const me = String(pb.authStore.record?.id ?? "");
  const [roster, setRoster] = useState<RosterPerson[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [subs, setSubs] = useState<{ id: string; name: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [subMembers, setSubMembers] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const [r, sh, rq, sg] = await Promise.all([
        fetchRosterPeople(groupId),
        pb.collection("lecture_shares").getFullList({ filter: pb.filter("lecture = {:l} && group = {:g} && owner = {:u}", { l: lecture.id, g: groupId, u: me }) }),
        fetchRequests(groupId),
        pb.collection("exam_subgroups").getFullList({ fields: "id,name" }),
      ]);
      setRoster(r);
      setShares(
        sh.map((x) => ({
          id: x.id,
          lecture: String(x.lecture),
          owner: String(x.owner),
          grantee: String(x.grantee),
          group: String(x.group ?? ""),
          subgroup: String(x.subgroup ?? ""),
          allowCopy: x.allow_copy === true,
          suspended: x.suspended === true,
          created: String(x.created),
        }))
      );
      setRequests(rq.filter((x) => x.lecture === lecture.id && x.owner === me && x.status === "open"));
      setSubs(sg.map((x) => ({ id: x.id, name: String(x.name) })));
      const ids = [...new Set(sh.filter((x) => x.subgroup).map((x) => String(x.subgroup)))];
      const entries = await Promise.all(ids.map(async (id) => [id, (await fetchMySubgroup(id))?.members ?? []] as const));
      setSubMembers(Object.fromEntries(entries));
    } catch {
      setError("Не удалось загрузить доступ. Проверь связь и попробуй ещё раз.");
    }
  }, [groupId, lecture.id, me]);

  useEffect(() => {
    if (open) {
      setError("");
      setAdding(false);
      void load();
    }
  }, [open, load]);

  const rows: Row[] = [];
  for (const s of shares) {
    if (s.subgroup) {
      let r = rows.find((x) => x.key === `s${s.subgroup}`);
      if (!r) {
        const first = (id: string) => (id === me ? "Ты" : (roster.find((x) => x.id === id)?.name ?? "Участник").split(" ")[0]);
        const members = [...(subMembers[s.subgroup] ?? [])].sort((a, b) => (a === me ? -1 : b === me ? 1 : 0)).map(first);
        r = {
          key: `s${s.subgroup}`,
          name: `Подгруппа «${subs.find((x) => x.id === s.subgroup)?.name ?? "…"}»`,
          sub: true,
          subgroup: s.subgroup,
          ids: [],
          allowCopy: s.allowCopy,
          note: members.length ? members.slice(0, 3).join(members.length === 2 ? " и " : ", ") : "",
        };
        rows.push(r);
      }
      r.ids.push(s.id);
    } else {
      const p = roster.find((x) => x.id === s.grantee);
      rows.push({ key: `u${s.grantee}`, name: p?.name ?? "Участник", sub: false, userId: s.grantee, avatar: p?.avatar, ids: [s.id], allowCopy: s.allowCopy });
    }
  }
  const sharedUsers = new Set(shares.filter((s) => !s.subgroup).map((s) => s.grantee));
  const sharedSubs = new Set(shares.filter((s) => s.subgroup).map((s) => s.subgroup));
  const peopleLeft = roster.filter((p) => p.id !== me && !sharedUsers.has(p.id));
  const subsLeft = subs.filter((s) => !sharedSubs.has(s.id));

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };

  const toggleCopy = (r: Row) =>
    run(r.key, async () => {
      await Promise.all(r.ids.map((id) => pb.collection("lecture_shares").update(id, { allow_copy: !r.allowCopy })));
    });

  const request = requests[0];
  const requester = request ? roster.find((p) => p.id === request.requester) : undefined;

  return (
    <Modal open={open} onClose={onClose} title="Доступ к лекции" className="c-gr-acc-dialog">
      <div className="c-gr-sheet-body c-gr-acc">
        <p className="c-gr-acc-sub">{lecture.title}</p>
        <span className="c-gr-over">Кто читает лекцию</span>
        <div className="c-gr-acc-list">
          {rows.length === 0 && <p className="c-gr-hint" style={{ padding: "12px 0" }}>Пока никто. Добавь человека или подгруппу.</p>}
          {rows.map((r) => (
            <div key={r.key} className="c-gr-prow">
              {r.sub ? <span className="c-gr-ava sm">{groupInitials(r.name.replace(/^Подгруппа «|»$/g, ""))}</span> : <Ava id={r.userId ?? ""} name={r.name} avatar={r.avatar} size="sm" />}
              <div className="tx">
                <span className="t">{r.name}</span>
                <span className="m">{r.sub && r.note ? r.note : "Читает"}</span>
              </div>
              <div className="acts">
                <label className="c-gr-copy">
                  <input type="checkbox" checked={r.allowCopy} disabled={busy === r.key} onChange={() => void toggleCopy(r)} />
                  <span className="box" aria-hidden="true">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  </span>
                  Можно копировать
                </label>
                <Button variant="secondary" size="sm" loading={busy === `x${r.key}`} onClick={() => void run(`x${r.key}`, () => revokeShares(r.ids))}>
                  <Icon name="x" size={14} /> Убрать
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="c-gr-acc-add">
          <button type="button" className="c-gr-addbtn" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            <Icon name="plus" size={18} /> Добавить человека или подгруппу
          </button>
          <Button variant="primary" onClick={onClose}>
            Готово
          </Button>
        </div>
        {adding && (
          <div className="c-gr-addlist">
            {subsLeft.map((s) => (
              <button key={s.id} type="button" className="it" onClick={() => void run(`a${s.id}`, async () => { await shareWithSubgroup(lecture.id, s.id, false); })}>
                <span className="c-gr-ava xs">{groupInitials(s.name)}</span>Подгруппа «{s.name}»
              </button>
            ))}
            {peopleLeft.map((p) => (
              <button key={p.id} type="button" className="it" onClick={() => void run(`a${p.id}`, () => grantLecture(lecture.id, p.id, groupId, false))}>
                <Ava id={p.id} name={p.name} avatar={p.avatar} size="xs" />
                {p.name}
              </button>
            ))}
            {peopleLeft.length + subsLeft.length === 0 && <p className="c-gr-hint">Все уже добавлены.</p>}
          </div>
        )}
        {error ? <p className="c-gr-error">{error}</p> : null}

        {request && (
          <div className="c-gr-req">
            <span className="lbl">Запрос доступа</span>
            <div className="line">
              <Ava id={request.requester} name={requester?.name ?? "Участник"} avatar={requester?.avatar} size="xs" />
              <span className="tx">
                <b>{requester?.name ?? "Участник"}</b> просит доступ к этой лекции
              </span>
              <button type="button" className="c-gr-linkbtn" style={{ color: "var(--ink)" }} onClick={() => void run(request.id, () => resolveRequest(request.id, "decline"))}>
                Отклонить
              </button>
              <Button variant="dark" loading={busy === request.id} onClick={() => void run(request.id, () => resolveRequest(request.id, "grant"))}>
                Разрешить
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
