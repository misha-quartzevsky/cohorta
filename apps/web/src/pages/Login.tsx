/**
 * ============================================
 *  Login.tsx — Sign-in / Sign-up Page
 * ============================================
 *
 * Email/password form inside a centered glassmorphism
 * card with a Вход ↔ Регистрация mode switch.  After a
 * successful sign-in / sign-up redirects back to the
 * originally requested page (`location.state.from`).
 *
 * A `?invite=<code>` query param (group invite link) is
 * stashed in sessionStorage so it survives the mode
 * switch; the actual auto-join happens after auth (P1/P2).
 */

import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { loginErrorMessage, registerErrorMessage } from "../lib/authErrors";
import { joinByInviteCode } from "../services/groupService";

const PENDING_INVITE_KEY = "cohorta:pendingInvite";
const MIN_PASSWORD = 8;

type Mode = "login" | "register";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isValid, login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Keep the group invite code across the login ↔ register switch.
  useEffect(() => {
    const invite = searchParams.get("invite");
    if (invite) {
      try {
        sessionStorage.setItem(PENDING_INVITE_KEY, invite);
      } catch {
        /* private mode / storage disabled — nothing to keep */
      }
    }
  }, [searchParams]);

  // Already signed in — straight to the dashboard.
  if (isValid) return <Navigate to="/" replace />;

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const isRegister = mode === "register";

  const switchMode = () => {
    setMode(isRegister ? "login" : "register");
    setError("");
    setPasswordConfirm("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    if (isRegister) {
      if (password.length < MIN_PASSWORD) {
        setError(`Пароль должен быть не короче ${MIN_PASSWORD} символов.`);
        return;
      }
      if (password !== passwordConfirm) {
        setError("Пароли не совпадают.");
        return;
      }
    }

    setSubmitting(true);
    setError("");
    try {
      if (isRegister) {
        await register(email.trim(), password, passwordConfirm);
      } else {
        await login(email.trim(), password);
      }
      // Пришли по ссылке-приглашению в группу — автовступление. Реферальную
      // атрибуцию (invited_by = owner группы) ставит серверный хук; ошибка
      // вступления не должна блокировать вход.
      let invite = "";
      try {
        invite = sessionStorage.getItem(PENDING_INVITE_KEY) ?? "";
        sessionStorage.removeItem(PENDING_INVITE_KEY);
      } catch {
        /* storage disabled */
      }
      if (invite) {
        try {
          await joinByInviteCode(invite);
        } catch (joinErr) {
          console.warn("Автовступление по коду не удалось:", joinErr);
        }
      }
      navigate(from, { replace: true });
    } catch (err) {
      console.error(isRegister ? "Ошибка регистрации:" : "Ошибка входа:", err);
      setError(
        isRegister ? registerErrorMessage(err) : loginErrorMessage(err)
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="login-logo" src="/cohorta-black.svg" alt="Cohorta" />

        <h1 className="login-title">
          {isRegister ? "Регистрация в Cohorta" : "Вход в Cohorta"}
        </h1>
        <p className="login-subtitle">
          Конспекты, курсы и заметки — всё в одном месте
        </p>

        {searchParams.get("deletion") === "1" && (
          <p className="login-notice">
            Запрос на удаление аккаунта принят. Мы свяжемся с вами по email.
          </p>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span className="login-label">Email</span>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              required
            />
          </label>

          <label className="login-field">
            <span className="login-label">Пароль</span>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
          </label>

          {isRegister && (
            <label className="login-field">
              <span className="login-label">Повторите пароль</span>
              <input
                className="login-input"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </label>
          )}

          {error && <p className="login-error">{error}</p>}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting && <Loader2 size={18} className="spin" />}
            {submitting
              ? isRegister
                ? "Регистрация…"
                : "Вход…"
              : isRegister
                ? "Зарегистрироваться"
                : "Войти"}
          </button>
        </form>

        <button
          type="button"
          className="login-switch"
          onClick={switchMode}
        >
          {isRegister
            ? "Уже есть аккаунт? Войти"
            : "Нет аккаунта? Зарегистрироваться"}
        </button>

        <Link to="/privacy" className="login-footer-link">
          Политика данных
        </Link>
      </div>
    </div>
  );
}

export default Login;
