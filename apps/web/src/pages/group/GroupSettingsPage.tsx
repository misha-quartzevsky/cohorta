import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Icon, Input, Menu, Modal } from "../../ui";
import { Ava, Crumbs, useSem } from "../../components/group/common";
import { inviteLink } from "../../components/group/InvitePopover";
import { studentsLabel } from "../../components/group/GroupSidebarBlock";
import { useGroupCtx } from "../../lib/groupCtx";
import { useGroupData } from "../../hooks/useGroupData";
import { useAuth } from "../../hooks/useAuth";
import { errorMessage } from "../../lib/format";
import {
  fetchInvite,
  kickMember,
  leaveGroupApi,
  renameGroup,
  resetInvite,
  setInviteEnabled,
  transferOwner,
} from "../../services/groupApi";

type Dialog = null | { kind: "leave" } | { kind: "transfer" } | { kind: "reset" } | { kind: "kick"; id: string; name: string };

/**
 * Настройки группы (Screen-group-settings, Screen-group-settings-member, Screen-m-group-settings) и окна про членство
 * (Screen-group-leave, Screen-m-group-transfer). Владелец видит ссылку и участников с меню; участник — только название,
 * людей и «Выйти из группы». Опасные действия красные, оранжевой кнопки на экране нет.
 */
export default function GroupSettingsPage() {
  const sem = useSem();
  const navigate = useNavigate();
  const { current, refresh, groups, select } = useGroupCtx();
  const { user } = useAuth();
  const data = useGroupData();
  const g = current!;
  const owner = g.isOwner;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(g.group.name);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [remember, setRemember] = useState(true);
  const [heir, setHeir] = useState("");
  const enabled = g.group.invite_enabled === true;

  useEffect(() => setName(g.group.name), [g.group.name]);
  useEffect(() => {
    if (!owner) return;
    fetchInvite(g.group.id)
      .then((r) => setCode(r.code))
      .catch(() => setCode(""));
  }, [owner, g.group.id]);

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setDialog(null);
      after?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const others = data.roster.filter((p) => p.id !== user?.id);

  const afterLeave = async () => {
    await refresh();
    const left = groups.filter((x) => x.group.id !== g.group.id);
    if (left[0]) select(left[0].group.id);
    navigate(left[0] ? `/s/${sem}/group` : `/s/${sem}`, { replace: true });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Не получилось скопировать. Выдели ссылку и скопируй вручную.");
    }
  };

  const leaveClick = () => {
    setError("");
    if (owner && others.length > 0) {
      setHeir(others[0]?.id ?? "");
      setDialog({ kind: "transfer" });
    } else setDialog({ kind: "leave" });
  };

  return (
    <div className="c-gr-page c-gr-set">
      <Crumbs items={[{ label: g.group.name, to: `/s/${sem}/group` }, { label: "Настройки" }]} />
      <header className="c-gr-head">
        <div className="tx">
          <h1>Настройки группы</h1>
          <span className="sub">
            {g.group.name} · {owner ? "ты владелец" : studentsLabel(g.members)}
          </span>
        </div>
      </header>
      {error && !dialog ? <p className="c-gr-error">{error}</p> : null}

      <section className="c-gr-section">
        <h2>Название</h2>
        <p className="lead">Видно всем участникам.</p>
        <div className="row-line">
          {editing ? (
            <>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Название группы" />
              <Button
                variant="dark"
                loading={busy}
                disabled={!name.trim()}
                onClick={() =>
                  void run(
                    async () => {
                      await renameGroup(g.group.id, name);
                      await refresh();
                    },
                    () => setEditing(false)
                  )
                }
              >
                Сохранить
              </Button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 15 }}>{g.group.name}</span>
              {owner && (
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  Изменить
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      {owner && (
        <section className="c-gr-section">
          <h2>Ссылка-приглашение</h2>
          <p className="lead">Видишь и сбрасываешь только ты. По умолчанию ссылка закрыта.</p>
          <div className="row-line" style={{ justifyContent: "flex-start" }}>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              className="c-gr-switch"
              onClick={() => void run(async () => { await setInviteEnabled(g.group.id, !enabled); await refresh(); })}
            >
              <span className="tr" />
              Вступать по ссылке
            </button>
          </div>
          {enabled && (
            <>
              <div className="linkrow">
                <div className="c-gr-codebox">{code ? inviteLink(code) : "…"}</div>
                <Button variant="secondary" onClick={() => void copy()} disabled={!code}>
                  {copied ? "Скопировано" : "Копировать"}
                </Button>
                <Button variant="secondary" onClick={() => setDialog({ kind: "reset" })}>
                  Сбросить код
                </Button>
              </div>
              <p className="c-gr-hint">После сброса старая ссылка перестанет работать. Те, кто уже в группе, останутся.</p>
            </>
          )}
        </section>
      )}

      <section className="c-gr-section">
        <h2>Участники · {data.roster.length}</h2>
        <p className="lead">Владелец один. Остальные могут всё, кроме ссылки и исключения.</p>
        <div style={{ marginTop: 8 }}>
          {data.roster.map((p) => {
            const mine = p.id === user?.id;
            const isOwnerRow = p.id === g.group.owner;
            return (
              <div key={p.id} className="c-gr-prow">
                <Ava id={p.id} name={p.name} avatar={p.avatar} size="sm" />
                <div className="tx">
                  <span className="t">
                    {p.name}
                    {mine ? " (ты)" : ""}
                  </span>
                </div>
                {isOwnerRow ? (
                  <span className="c-gr-chip-owner">Владелец</span>
                ) : owner ? (
                  <Menu
                    width={248}
                    aria-label={`Действия: ${p.name}`}
                    trigger={(t) => (
                      <button type="button" className="c-shell-more" aria-label={`Действия: ${p.name}`} onClick={t.onClick} ref={t.ref} aria-expanded={t["aria-expanded"]} aria-haspopup={t["aria-haspopup"]}>
                        <Icon name="dots" size={20} />
                      </button>
                    )}
                    items={[
                      {
                        label: "Сделать владельцем",
                        icon: <Icon name="user" size={18} />,
                        onClick: () => void run(async () => { await transferOwner(g.group.id, p.id); await refresh(); await data.refetch(); }),
                      },
                      { label: "Исключить из группы", icon: <Icon name="logout" size={18} />, danger: true, separatorBefore: true, onClick: () => setDialog({ kind: "kick", id: p.id, name: p.name }) },
                    ]}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <Button className="c-gr-leave" variant="danger" onClick={leaveClick}>
        Выйти из группы
      </Button>

      {/* Выйти из группы */}
      <Modal open={dialog?.kind === "leave"} onClose={() => setDialog(null)} title={`Выйти из ${g.group.name}?`}>
        <div className="c-gr-sheet-body">
          <p>Одногруппники сразу потеряют доступ к твоим лекциям. Доступ, который открыли тебе, сохранится на случай возвращения.</p>
          <label className="c-gr-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Запомнить мои доступы на случай возвращения
          </label>
          {error ? <p className="c-gr-error">{error}</p> : null}
          <div className="c-gr-modal-actions">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Отмена
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void run(() => leaveGroupApi(g.group.id, remember), () => void afterLeave())}>
              Выйти из группы
            </Button>
          </div>
        </div>
      </Modal>

      {/* Передай группу */}
      <Modal open={dialog?.kind === "transfer"} onClose={() => setDialog(null)} title="Передай группу">
        <div className="c-gr-sheet-body">
          <p>Ты владелец. Назови нового владельца, потом выйдешь. Без этого выйти нельзя.</p>
          <div className="c-gr-pick" role="radiogroup" aria-label="Новый владелец">
            {others.map((p) => (
              <label key={p.id} className={heir === p.id ? "on" : ""}>
                <input type="radio" name="heir" checked={heir === p.id} onChange={() => setHeir(p.id)} />
                <Ava id={p.id} name={p.name} avatar={p.avatar} size="xs" />
                {p.name}
              </label>
            ))}
          </div>
          {error ? <p className="c-gr-error">{error}</p> : null}
          <div className="c-gr-modal-actions">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Отмена
            </Button>
            <Button
              variant="dark"
              loading={busy}
              disabled={!heir}
              onClick={() =>
                void run(
                  async () => {
                    await transferOwner(g.group.id, heir);
                    await leaveGroupApi(g.group.id, remember);
                  },
                  () => void afterLeave()
                )
              }
            >
              Передать и выйти
            </Button>
          </div>
        </div>
      </Modal>

      {/* Сбросить ссылку */}
      <Modal open={dialog?.kind === "reset"} onClose={() => setDialog(null)} title="Сбросить ссылку?">
        <div className="c-gr-sheet-body">
          <p>Старая ссылка перестанет работать. Те, кто уже в группе, останутся. Новую ссылку увидишь только ты.</p>
          {error ? <p className="c-gr-error">{error}</p> : null}
          <div className="c-gr-modal-actions">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Отмена
            </Button>
            <Button variant="dark" loading={busy} onClick={() => void run(async () => setCode((await resetInvite(g.group.id)).code))}>
              Сбросить
            </Button>
          </div>
        </div>
      </Modal>

      {/* Исключить */}
      <Modal open={dialog?.kind === "kick"} onClose={() => setDialog(null)} title={`Исключить ${dialog?.kind === "kick" ? dialog.name : ""}?`}>
        <div className="c-gr-sheet-body">
          <p>Он потеряет доступ ко всем лекциям группы и выйдет из её подгрупп. Вернуться сможет по ссылке, если она открыта.</p>
          {error ? <p className="c-gr-error">{error}</p> : null}
          <div className="c-gr-modal-actions">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => dialog?.kind === "kick" && void run(async () => { await kickMember(g.group.id, dialog.id); await refresh(); await data.refetch(); })}
            >
              Исключить
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
