/**
 * ============================================
 *  AccountActions.tsx — гигиена аккаунта в профиле сайдбара
 * ============================================
 *
 * Две ссылки под профилем: «Политика данных» (→ /privacy) и
 * «Удалить аккаунт и данные» (запрос на удаление, обрабатывается
 * вручную). Диалог подтверждения — свой, портальный.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { X } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import {
  fetchMyDeletionRequest,
  requestDeletion,
} from "../services/deletionService";

export default function AccountActions() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyDeletionRequest()
      .then((r) => {
        if (!cancelled) setPending(!!r);
      })
      .catch(() => {
        /* keep default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    setBusy(true);
    try {
      await requestDeletion();
      logout();
      navigate("/login?deletion=1", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sidebar-account-actions">
      <Link to="/privacy" className="sidebar-account-link">
        Политика данных
      </Link>
      {pending ? (
        <span className="sidebar-account-note">Запрос на удаление отправлен</span>
      ) : (
        <button
          type="button"
          className="sidebar-account-link danger"
          onClick={() => setConfirmOpen(true)}
        >
          Удалить аккаунт и данные
        </button>
      )}

      {confirmOpen &&
        createPortal(
          <div
            className="confirm-backdrop"
            onClick={() => setConfirmOpen(false)}
          >
            <div
              className="confirm-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="confirm-close"
                type="button"
                aria-label="Закрыть"
                onClick={() => setConfirmOpen(false)}
              >
                <X size={18} />
              </button>
              <h3 className="confirm-title">Удалить аккаунт и данные</h3>
              <p className="confirm-message">
                Мы обработаем запрос вручную и свяжемся с вами по email.
                После удаления все ваши курсы, конспекты и карточки будут
                стёрты без возможности восстановления.
              </p>
              <div className="confirm-actions">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={busy}
                >
                  Отмена
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={submit}
                  disabled={busy}
                >
                  Отправить запрос
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
