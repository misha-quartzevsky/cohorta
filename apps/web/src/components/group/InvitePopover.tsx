import { useEffect, useState, type ReactNode } from "react";
import { Button, Icon, Popover } from "../../ui";
import { fetchInvite, formatCode, resetInvite, setInviteEnabled } from "../../services/groupApi";
import { errorMessage } from "../../lib/format";

export function inviteLink(code: string): string {
  return `cohorta.ru/join/${formatCode(code)}`;
}

/** «Пригласить в …» (Screen-group-home): ссылка и код видны и копируются только владельцем. */
export default function InvitePopover({
  groupId,
  groupName,
  enabled,
  open,
  onOpen,
  onClose,
  onChanged,
  trigger,
}: {
  groupId: string;
  groupName: string;
  enabled: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChanged: () => void;
  trigger: (props: { onClick: () => void }) => ReactNode;
}) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    fetchInvite(groupId)
      .then((r) => setCode(r.code))
      .catch(() => setError("Не удалось получить ссылку."));
  }, [open, groupId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Не получилось скопировать. Выдели ссылку и скопируй вручную.");
    }
  };

  const enable = async () => {
    setBusy(true);
    try {
      await setInviteEnabled(groupId, true);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const r = await resetInvite(groupId);
      setCode(r.code);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      align="end"
      className="c-gr-invite-pop"
      trigger={trigger({ onClick: () => (open ? onClose() : onOpen()) })}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Пригласить в {groupName}</h3>
        <button type="button" className="c-gr-linkbtn" aria-label="Закрыть" onClick={onClose} style={{ color: "var(--ink-2)" }}>
          <Icon name="x" size={18} />
        </button>
      </div>
      {enabled ? (
        <>
          <p>
            Пришли ссылку или код одногруппнику. Вступить может любой, у кого он есть, но твои лекции останутся закрытыми, пока ты сам не откроешь доступ.
          </p>
          <div className="row">
            <div className="c-gr-codebox" style={{ fontWeight: 400, fontSize: 14 }}>
              {code ? inviteLink(code) : "…"}
            </div>
            <Button variant="secondary" onClick={() => void copy()} disabled={!code}>
              {copied ? "Скопировано" : "Копировать"}
            </Button>
          </div>
          <div className="code">
            <span>
              Код <b>{formatCode(code)}</b>
            </span>
            <button type="button" className="c-gr-linkbtn" onClick={() => void reset()} disabled={busy}>
              Сбросить код
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Ссылка закрыта: по коду вступить нельзя. Открой её, когда будешь готов принимать людей. Закрыть снова можно в настройках группы.</p>
          <Button variant="secondary" onClick={() => void enable()} loading={busy}>
            Открыть ссылку
          </Button>
        </>
      )}
      {error ? <p className="c-gr-error">{error}</p> : null}
    </Popover>
  );
}
