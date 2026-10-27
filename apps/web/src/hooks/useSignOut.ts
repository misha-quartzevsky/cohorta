import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "./useAuth";

/** «Выйти»: сбросить сессию и вернуться на экран входа (профиль на телефоне и настройки на компьютере). */
export function useSignOut(): () => void {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return useCallback(() => {
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);
}
