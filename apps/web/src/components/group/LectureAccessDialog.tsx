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
import type { Lecture } from "../../lib/types";

interface Row {
  key: string;
  name: string;
  sub: boolean;
  userId?: string;
  avatar?: string;
  ids: string[];
  allowCopy: boolean;
}

/**
 * «Доступ к лекции» (Screen-group-access): кто читает, добавить человека или подгруппу, запрос на доступ.
 * Открывается из меню лекции «Доступ в группе». «Разрешить копировать» хранится на каждом выданном доступе отдельно.
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
  const [copyNext, setCopyNext] = useState(false);
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
        r = { key: `s${s.subgroup}`, name: `Подгруппа «${subs.find((x) => x.id === s.subgroup)?.name ?? "…"}»`, sub: true, ids: [], allowCopy: s.allowCopy };
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
    <Modal open={open} onClose={onClose} title="Доступ к лекции">
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
                <span className="m">
                  Читает ·{" "}
                  <button type="button" className="c-gr-linkbtn" onClick={() => void toggleCopy(r)} disabled={busy === r.key}>
                    {r.allowCopy ? "копировать можно" : "разрешить копировать"}
                  </button>
                </span>
              </div>
              <div className="acts">
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
            <label className="c-gr-check">
              <input type="checkbox" checked={copyNext} onChange={(e) => setCopyNext(e.target.checked)} />
              Разрешить копировать
            </label>
            {subsLeft.map((s) => (
              <button key={s.id} type="button" className="it" onClick={() => void run(`a${s.id}`, async () => { await shareWithSubgroup(lecture.id, s.id, copyNext); })}>
                <span className="c-gr-ava xs">{groupInitials(s.name)}</span>Подгруппа «{s.name}»
              </button>
            ))}
            {peopleLeft.map((p) => (
              <button key={p.id} type="button" className="it" onClick={() => void run(`a${p.id}`, () => grantLecture(lecture.id, p.id, groupId, copyNext))}>
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
