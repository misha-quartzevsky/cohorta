import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Icon, Modal, Pills, StatusChip } from "../../ui";
import { Ava, useSem } from "../../components/group/common";
import { GroupList, studentsLabel } from "../../components/group/GroupSidebarBlock";
import InvitePopover from "../../components/group/InvitePopover";
import { useGroupCtx } from "../../lib/groupCtx";
import { useGroupData } from "../../hooks/useGroupData";
import { useUiShell } from "../../lib/uiShellContext";
import { useAuth } from "../../hooks/useAuth";
import { useNotify } from "../../lib/notifyCtx";
import { pluralRu } from "../../lib/format";
import { buildPeople, groupInitials, restorableCount, restoreAccess, ruDate, type PersonCard } from "../../services/groupApi";

function lecturesLabel(n: number): string {
  return `${n} ${pluralRu(n, ["лекция", "лекции", "лекций"])}`;
}
function subjectsLabel(n: number): string {
  return `${n} ${pluralRu(n, ["предмет", "предмета", "предметов"])}`;
}

function PersonStat({ p }: { p: PersonCard }) {
  return p.lectures === null ? null : (
    <span className="meta">
      {lecturesLabel(p.lectures)} · {subjectsLabel(p.courses ?? 0)}
    </span>
  );
}

/**
 * Главная группы (Screen-group-home, Screen-m-group-people): одногруппники списком карточек.
 * Число лекций и предметов видно только у тех, кто открыл предпросмотр: у остальных оно не раскрывается.
 */
export default function GroupHomePage() {
  const sem = useSem();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { current, refresh } = useGroupCtx();
  const { user } = useAuth();
  const { openSearch } = useUiShell();
  const data = useGroupData();
  const { markSeen } = useNotify();
  useEffect(() => markSeen("group"), [markSeen]);
  const [filter, setFilter] = useState<"all" | "open">("all");
  const [inviteOpen, setInviteOpen] = useState(params.get("invite") === "1");
  const [sheet, setSheet] = useState(false);
  const [restore, setRestore] = useState<number>(0);
  const [restoring, setRestoring] = useState(false);

  const g = current!;
  /** Шестерёнка (Screen-group-home, Screen-m-group-people): настройки группы; из них путь обратно в «Люди». */
  const openSettings = () => navigate(`/s/${sem}/group/settings`, { state: { from: "group" } });
  const isOwner = g.isOwner;
  const people = useMemo(() => buildPeople(data.roster, data.previews, data.shares, g.group.owner), [data.roster, data.previews, data.shares, g.group.owner]);
  const shown = filter === "open" ? people.filter((p) => p.previewEnabled) : people;
  const openCount = people.filter((p) => p.previewEnabled).length;
  const me = data.roster.find((p) => p.id === user?.id);

  // Вернувшемуся в группу предлагается вернуть прежние доступы (если при выходе стояла галочка).
  useEffect(() => {
    let alive = true;
    restorableCount(g.group.id)
      .then((n) => {
        const key = `cohorta:restore-asked:${g.group.id}:${n}`;
        let asked = false;
        try {
          asked = localStorage.getItem(key) === "1";
        } catch {
          asked = false;
        }
        if (alive && n > 0 && !asked) setRestore(n);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [g.group.id]);

  const closeRestore = () => {
    try {
      localStorage.setItem(`cohorta:restore-asked:${g.group.id}:${restore}`, "1");
    } catch {
      /* без хранилища спросим ещё раз */
    }
    setRestore(0);
  };

  const sinceText = me?.joinedAt ? `в группе с ${ruDate(me.joinedAt)}` : "";
  const sub = `${studentsLabel(g.members)} · ${isOwner ? "ты владелец" : "ты"}${sinceText ? `, ${sinceText}` : ""}`.replace("· ты,", "· ты");

  const inviteBtn = (p: { onClick: () => void }) => (
    <Button variant="primary" className="c-gr-invite-btn-d" onClick={p.onClick}>
      <Icon name="plus" size={18} /> Пригласить
    </Button>
  );

  return (
    <div className="c-gr-page">
      {/* Телефон: название группы открывает переключатель, «+» — приглашение, лупа — поиск */}
      <div className="c-gr-mhead">
        <button type="button" className="grp" onClick={() => setSheet(true)} aria-label="Переключить группу">
          <span className="c-gr-mark dark">{groupInitials(g.group.name)}</span>
          {g.group.name}
          <Icon name="chevd" size={18} />
        </button>
        <div className="btns">
          <button type="button" className="sq ghost" aria-label="Настройки группы" onClick={openSettings}>
            <Icon name="gear" size={20} />
          </button>
          {isOwner && (
            <InvitePopover
              groupId={g.group.id}
              groupName={g.group.name}
              enabled={g.group.invite_enabled === true}
              open={inviteOpen}
              onOpen={() => setInviteOpen(true)}
              onClose={() => {
                setInviteOpen(false);
                if (params.get("invite")) setParams({}, { replace: true });
              }}
              onChanged={() => void refresh()}
              trigger={(p) => (
                <button type="button" className="sq" aria-label="Пригласить" onClick={p.onClick}>
                  <Icon name="plus" size={20} />
                </button>
              )}
            />
          )}
          <button type="button" className="sq ghost" aria-label="Поиск" onClick={openSearch}>
            <Icon name="search" size={22} />
          </button>
        </div>
      </div>
      <header className="c-gr-head">
        <div className="tx">
          <h1 className="c-gr-title-d">{g.group.name}</h1>
          <span className="sub"><span className="d-only">{sub}</span><span className="m-only">{studentsLabel(g.members)}</span></span>
        </div>
        <div className="acts">
          <button type="button" className="c-gr-gear c-gr-gear-d" aria-label="Настройки группы" onClick={openSettings}>
            <Icon name="gear" size={20} />
          </button>
          {isOwner && (
            <InvitePopover
              groupId={g.group.id}
              groupName={g.group.name}
              enabled={g.group.invite_enabled === true}
              open={inviteOpen}
              onOpen={() => setInviteOpen(true)}
              onClose={() => setInviteOpen(false)}
              onChanged={() => void refresh()}
              trigger={inviteBtn}
            />
          )}
        </div>
      </header>

      <div className="c-gr-pills">
        <Pills
          aria-label="Показать"
          value={filter}
          onChange={(v) => setFilter(v as "all" | "open")}
          options={[
            { value: "all", label: `Все ${people.length}` },
            { value: "open", label: `С открытым предпросмотром ${openCount}` },
          ]}
        />
      </div>

      {data.error ? <p className="c-gr-error">{data.error}</p> : null}

      <div className="c-gr-people">
        {shown.map((p) => (
          <article key={p.id} className="c-gr-person">
            <div className="top">
              <Ava id={p.id} name={p.name} avatar={p.avatar} />
              <div className="nm">
                <span className="name">{p.name}</span>
                <PersonStat p={p} />
              </div>
            </div>
            <div className="bot">
              <StatusChip tone={p.previewEnabled ? "ok" : "neutral"}>{p.previewEnabled ? "Предпросмотр открыт" : "Предпросмотр закрыт"}</StatusChip>
              {p.previewEnabled || p.openedToMe > 0 ? (
                <Button variant="secondary" size="sm" onClick={() => navigate(`/s/${sem}/group/people/${p.id}`)}>
                  Открыть
                </Button>
              ) : (
                <span className="hidden">Лекции скрыты</span>
              )}
            </div>
          </article>
        ))}
      </div>

      <ul className="c-gr-list c-gr-plist">
        {shown.map((p) => (
          <li key={p.id}>
            <Link className="c-gr-row" to={`/s/${sem}/group/people/${p.id}`}>
              <Ava id={p.id} name={p.name} avatar={p.avatar} />
              <span className="tx">
                <span className="t">{p.name}</span>
                <span className="m">{p.lectures === null ? "Лекции скрыты" : `${lecturesLabel(p.lectures)} · ${subjectsLabel(p.courses ?? 0)}`}</span>
              </span>
              <span className="end">
                <StatusChip tone={p.previewEnabled ? "ok" : "neutral"}>{p.previewEnabled ? "Открыт" : "Закрыт"}</StatusChip>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {!data.loading && people.length === 0 ? (
        <p className="c-gr-hint">Пока в группе только ты. Пришли ссылку одногруппникам{isOwner ? " (кнопка «Пригласить»)" : ""}.</p>
      ) : null}

      <Modal open={sheet} onClose={() => setSheet(false)} title="Твои группы">
        <GroupList semSlug={sem} onPick={() => setSheet(false)} />
      </Modal>

      <Modal open={restore > 0} onClose={closeRestore} title="Вернуть прежние доступы?">
        <div className="c-gr-sheet-body">
          <p>
            Раньше ты открывал лекции одногруппникам: {restore} {pluralRu(restore, ["доступ", "доступа", "доступов"])}. Вернуть их? Доступ, открытый тебе, уже на месте.
          </p>
          <div className="c-gr-modal-actions">
            <Button variant="ghost" onClick={closeRestore}>
              Не возвращать
            </Button>
            <Button
              variant="primary"
              loading={restoring}
              onClick={async () => {
                setRestoring(true);
                try {
                  await restoreAccess(g.group.id);
                  await data.refetch();
                } finally {
                  setRestoring(false);
                  closeRestore();
                }
              }}
            >
              Вернуть ({restore})
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
