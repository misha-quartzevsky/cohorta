import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { loginErrorMessage, registerErrorMessage } from "../../lib/authErrors";
import { afterAuthTarget } from "../../lib/pendingInvite";
import { Button, Input } from "../../ui";
import AuthLayout from "./AuthLayout";

const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Вход и регистрация (Screen-login, Screen-register, Screen-m-register).
 * Подсказки об ошибках — под полем, не сверху. Регистрация: почта, пароль,
 * повтор; шаг «подтверди почту» подготовлен (ResetPages), но выключен.
 */
export default function LoginPageNew({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isValid, login, register } = useAuth();
  const isRegister = mode === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  // Сразу после входа isValid меняется раньше, чем сработает navigate() из
  // submit, поэтому цель считаем здесь же (иначе ссылка-приглашение теряется).
  if (isValid) return <Navigate to={afterAuthTarget(from)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) {
      next.email = mail.includes("@") ? "Проверь адрес: не хватает домена" : "Проверь адрес: не хватает «@»";
    }
    if (isRegister) {
      if (password.length < MIN_PASSWORD) next.password = `Минимум ${MIN_PASSWORD} символов`;
      if (confirm !== password) next.confirm = "Пароли не совпадают";
    } else if (!password) {
      next.password = "Введи пароль";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      if (isRegister) await register(mail, password, confirm);
      else await login(mail, password);
      navigate(afterAuthTarget(from), { replace: true });
    } catch (err) {
      console.error(isRegister ? "Ошибка регистрации:" : "Ошибка входа:", err);
      setErrors({ form: isRegister ? registerErrorMessage(err) : loginErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      narrow={isRegister}
      title={isRegister ? "Регистрация в cohorta" : "Вход"}
      subtitle={<>Конспекты, задачи и подготовка к экзаменам<span className="c-auth-sub-extra"> в одном месте</span>.</>}
      footer={
        <>
          <div className="c-auth-switch">
            {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}
            <Link to={isRegister ? "/login" : "/register"} state={location.state}>
              {isRegister ? "Войти" : "Создать аккаунт"}
            </Link>
          </div>
          <span className="c-auth-legal">
            {isRegister ? "Создавая аккаунт, ты соглашаешься с " : "Продолжая, ты соглашаешься с "}
            <Link to="/privacy">политикой данных</Link>.
          </span>
        </>
      }
    >
      <form className="c-auth-form" onSubmit={submit} noValidate>
        <Input
          label="Почта"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          error={errors.email}
        />
        <Input
          label="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Минимум 8 символов"
          autoComplete={isRegister ? "new-password" : "current-password"}
          error={errors.password}
        />
        {isRegister && (
          <Input
            label="Повтори пароль"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            error={errors.confirm}
          />
        )}
        {!isRegister && (
          <Link className="c-auth-forgot" to="/reset">
            Забыли пароль?
          </Link>
        )}
        {errors.form && (
          <p className="c-auth-error" role="alert">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" loading={busy} className="c-auth-submit">
          {isRegister ? "Создать аккаунт" : "Войти"}
        </Button>
      </form>
    </AuthLayout>
  );
}
