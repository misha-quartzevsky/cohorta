import { useEffect, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { exportAccountZip } from "../../services/accountExport";
import { GroupOwnerError, requestAccountDeletion } from "../../services/deletionService";
import { fetchMyGroups, fetchRoster } from "../../services/groupService";
import { Button, Icon, Input, Modal } from "../../ui";

const CONFIRM_WORD = "удалить";

/**
 * Удаление аккаунта, шаги 1 и 2 (Screen-account-delete): предупреждение с
 * выгрузкой ZIP и проверкой «владелец группы сначала передаёт её», затем
 * подтверждение словом. Шаг 3 — экран «Аккаунт будет удалён …» при входе
 * (pages/PendingDeletionPage.tsx).
 */
export default function AccountDeleteFlow({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user, logout } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [zip, setZip] = useState("");
  const [error, setError] = useState("");
  const [ownedGroup, setOwnedGroup] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setWord("");
    setError("");
    setZip("");
    let alive = true;
    (async () => {
      try {
        const groups = await fetchMyGroups();
        for (const g of groups.filter((x) => x.owner === user?.id)) {
          const roster = await fetchRoster(g.id);
          if (roster.some((m) => m.user && m.user !== user?.id)) {
            if (alive) setOwnedGroup(String(g.name ?? ""));
            return;
          }
        }
        if (alive) setOwnedGroup("");
      } catch {
        if (alive) setOwnedGroup("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, user?.id]);

  const download = async () => {
    setZip("Собираем архив…");
    try {
      await exportAccountZip();
      setZip("Архив скачан");
    } catch {
      setZip("Не удалось собрать архив");
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await requestAccountDeletion();
      logout();
      onDone();
    } catch (e) {
      if (e instanceof GroupOwnerError) {
        setOwnedGroup(e.groupName);
        setStep(1);
      } else {
        setError("Не удалось отправить запрос. Попробуй ещё раз.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={step === 1 ? "Удалить аккаунт?" : "Подтверди удаление"} className="c-delete-dialog">
      {step === 1 ? (
        <div className="c-delete-body">
          <p>
            Мы скроем аккаунт сразу, а данные удалим через 14 дней. Конспекты, билеты, задачи и расписание исчезнут без
            восстановления.
          </p>
          <div className="c-delete-zip">
            <span className="ic" aria-hidden="true">
              <Icon name="doc" size={20} />
            </span>
            <div className="tx">
              <span className="t">Архив ZIP</span>
              <span className="m">Конспекты в Markdown, билеты, задачи, расписание</span>
              {zip ? (
                <span className="m" role="status">
                  {zip}
                </span>
              ) : null}
            </div>
            <Button variant="secondary" size="sm" onClick={() => void download()}>
              Скачать
            </Button>
          </div>
          {ownedGroup ? (
            <p className="c-delete-warn" role="alert">
              Ты владелец группы {ownedGroup}. Сначала передай владение: иначе группа останется без владельца.
            </p>
          ) : null}
          <div className="c-delete-actions">
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="danger" onClick={() => setStep(2)} disabled={Boolean(ownedGroup)}>
              Продолжить
            </Button>
          </div>
        </div>
      ) : (
        <div className="c-delete-body">
          <p>Введи слово «{CONFIRM_WORD}», чтобы мы убедились, что это ты.</p>
          <Input
            label="Подтверждение"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            hint="В течение 14 дней можно войти и отменить удаление."
            error={error || undefined}
            autoComplete="off"
            autoFocus
          />
          <div className="c-delete-actions">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={busy}>
              Назад
            </Button>
            <Button variant="danger" onClick={() => void confirm()} disabled={word.trim().toLowerCase() !== CONFIRM_WORD} loading={busy}>
              Удалить аккаунт
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
