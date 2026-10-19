import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { pb } from "../lib/pocketbase";
import { Button, Icon } from "../ui";

/** Токен есть, но срок его жизни вышел: сессия истекла посреди работы. */
function expired(): boolean {
  return Boolean(pb.authStore.token) && !pb.authStore.isValid;
}

/**
 * «Сессия истекла» (Screen-session-states, блок 1): окно поверх страницы.
 * Несохранённый текст лекции остаётся в очереди на устройстве
 * (lib/draftQueue.ts) и уйдёт после входа; после входа человека
 * возвращает на то же место (ProtectedRoute хранит адрес в state.from).
 */
export default function SessionGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(expired);

  useEffect(() => {
    const check = () => setOpen(expired());
    const timer = setInterval(check, 15_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!open) return null;
  const login = () => {
    const from = location.pathname + location.search;
    pb.authStore.clear();
    navigate("/login", { state: { from }, replace: true });
  };
  return (
    <div className="c-session-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="c-session-title">
      <div className="c-session-card">
        <span className="ic" aria-hidden="true">
          <Icon name="lock" size={20} />
        </span>
        <h2 id="c-session-title">Сессия истекла</h2>
        <p>Войди снова, и ты вернёшься на то же место. Несохранённый текст лекции останется на этом устройстве и отправится после входа.</p>
        <div className="actions">
          <Button variant="primary" size="lg" onClick={login} autoFocus>
            Войти
          </Button>
        </div>
      </div>
    </div>
  );
}
