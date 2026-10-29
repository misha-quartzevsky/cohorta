import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { listDrafts } from "../lib/draftQueue";
import { flushDraftsBeforeSignOut } from "../services/draftSync";
import { useAuth } from "./useAuth";

/**
 * «Выйти»: отправить несохранённый текст (если есть связь, не дольше 3 с), сбросить сессию (черновики этого человека
 * удаляются с устройства) и вернуться на экран входа (профиль на телефоне и настройки на компьютере).
 */
export function useSignOut(): () => void {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return useCallback(async () => {
    await flushDraftsBeforeSignOut();
    // не ушло (нет связи, сессия истекла): выход удалит этот текст с устройства, предупреждаем
    if (listDrafts().length > 0 && !window.confirm("Есть несохранённый текст лекции, он будет удалён с этого устройства. Выйти?")) return;
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);
}
