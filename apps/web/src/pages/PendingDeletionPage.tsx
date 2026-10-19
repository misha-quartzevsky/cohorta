import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { cancelAccountDeletion, deletionDateLabel } from "../services/deletionService";
import { Button } from "../ui";

/**
 * Шаг 3 удаления (Screen-account-delete): показывается при входе, пока идут
 * 14 дней. «Отменить удаление» возвращает аккаунт одним нажатием.
 */
export default function PendingDeletionPage({ scheduledFor, onCancelled }: { scheduledFor: string; onCancelled: () => void }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const date = deletionDateLabel(scheduledFor);

  const cancel = async () => {
    setBusy(true);
    setError("");
    try {
      await cancelAccountDeletion();
      onCancelled();
    } catch {
      setError("Не удалось отменить. Попробуй ещё раз.");
      setBusy(false);
    }
  };

  return (
    <main className="c-auth">
      <div className="c-auth-col c-delete-pending">
        <div className="c-auth-card">
          <div className="c-auth-head">
            <h1>{date ? `Аккаунт будет удалён ${date}` : "Аккаунт будет удалён"}</h1>
            <span>Ты запросил удаление. До этой даты можно передумать, и всё останется как было.</span>
          </div>
          {error ? (
            <p className="c-auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="c-delete-actions">
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              Выйти
            </Button>
            <Button variant="primary" size="lg" onClick={() => void cancel()} loading={busy}>
              Отменить удаление
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
