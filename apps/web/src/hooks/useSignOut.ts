import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

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
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);
}
