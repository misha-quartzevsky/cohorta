import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { isEmailAuthEnabled, SUPPORT_EMAIL } from "../../lib/featureFlags";
import { pb } from "../../lib/pocketbase";
import { Button, Input } from "../../ui";
import AuthLayout from "./AuthLayout";

const MIN_PASSWORD = 8;
const RESEND_SECONDS = 60;

function BackToLogin() {
  return (
    <Link className="c-auth-back" to="/login">
      Вернуться ко входу
    </Link>
  );
}

/**
 * «Не помнишь пароль?» — то, что работает сейчас, пока на cohorta.ru нет
 * почты. Ссылка «Забыли пароль?» на входе ведёт сюда (Screen-auth-reset,
 * блок «Сейчас: сброс пароля без почты»). Когда почта заработает
 * (VITE_AUTH_EMAIL=true), этот же адрес открывает запрос ссылки.
 */
export function ResetEntryPage() {
  return isEmailAuthEnabled() ? <ResetRequestPage /> : <SupportResetPage />;
}

function SupportResetPage() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* буфер недоступен — адрес виден на экране */
    }
  };
  return (
    <AuthLayout
      title="Не помнишь пароль?"
      subtitle="Пока сброс по почте не работает. Напиши нам, и мы поможем вернуть доступ."
      footer={<BackToLogin />}
    >
      <div className="c-auth-form">
        <div className="c-field">
          <label>Почта поддержки</label>
          <div className="c-auth-copy">
            <span className="c-auth-copy-val">{SUPPORT_EMAIL}</span>
            <Button variant="secondary" onClick={copy}>
              {copied ? "Скопировано" : "Скопировать"}
            </Button>
          </div>
        </div>
        <p className="c-auth-note">
          Напиши с той почты, на которую зарегистрирован аккаунт. Ответим в течение дня.
        </p>
      </div>
    </AuthLayout>
  );
}

/* ------- Ниже — экраны для почты. Подготовлены, включаются флагом. ------- */

function useResendTimer() {
  const [left, setLeft] = useState(RESEND_SECONDS);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, restart: () => setLeft(RESEND_SECONDS) };
}

function ResetRequestPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useResendTimer();

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await pb.collection("users").requestPasswordReset(email.trim());
    } catch {
      /* ответ всегда одинаковый: нельзя узнать, есть ли такая почта */
    }
    setBusy(false);
    setSent(true);
    timer.restart();
  };

  if (sent) {
    return (
      <AuthLayout
        title="Письмо отправлено"
        subtitle={`Если аккаунт с такой почтой есть, мы отправили на ${email.trim()} ссылку. Она действует 1 час.`}
        footer={<BackToLogin />}
      >
        <div className="c-auth-form">
          <p className="c-auth-note">
            Не пришло? Проверь «Спам» или отправь ещё раз через {timer.left > 0 ? `${timer.left} секунд` : "минуту"}.
          </p>
          <Button variant="secondary" size="lg" disabled={timer.left > 0 || busy} onClick={() => void send()}>
            Отправить ещё раз
          </Button>
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      title="Сброс пароля"
      subtitle="Укажи почту аккаунта. Мы отправим ссылку для нового пароля."
      footer={<BackToLogin />}
    >
      <form className="c-auth-form" onSubmit={send}>
        <Input label="Почта" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <Button type="submit" variant="primary" size="lg" loading={busy} className="c-auth-submit">
          Отправить ссылку
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ResetNewPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<{ pw?: string; pw2?: string }>({});
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"form" | "done" | "expired">("form");

  if (!isEmailAuthEnabled()) return <Navigate to="/reset" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof err = {};
    if (pw.length < MIN_PASSWORD) next.pw = `Минимум ${MIN_PASSWORD} символов`;
    if (pw !== pw2) next.pw2 = "Пароли не совпадают";
    setErr(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await pb.collection("users").confirmPasswordReset(token, pw, pw2);
      setState("done");
    } catch {
      setState("expired");
    } finally {
      setBusy(false);
    }
  };

  if (state === "done") {
    return (
      <AuthLayout title="Пароль изменён" subtitle="Теперь можно войти с новым паролем. На других устройствах войдёшь заново.">
        <Button variant="primary" size="lg" className="c-auth-submit" onClick={() => navigate("/login")}>
          Войти
        </Button>
      </AuthLayout>
    );
  }
  if (state === "expired") return <LinkExpiredPage />;
  return (
    <AuthLayout title="Новый пароль" subtitle="Придумай пароль, который раньше не использовал.">
      <form className="c-auth-form" onSubmit={submit} noValidate>
        <Input label="Новый пароль" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Минимум 8 символов" autoComplete="new-password" error={err.pw} />
        <Input label="Повтори пароль" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" error={err.pw2} />
        <Button type="submit" variant="primary" size="lg" loading={busy} className="c-auth-submit">
          Сохранить пароль
        </Button>
      </form>
    </AuthLayout>
  );
}

export function LinkExpiredPage() {
  return (
    <AuthLayout title="Ссылка устарела" subtitle="Она действует один час или уже использована. Запроси новую.">
      <Link to="/reset" className="c-btn primary lg c-auth-submit">
        Запросить новую ссылку
      </Link>
    </AuthLayout>
  );
}

/** Шаг «Подтверди почту» между регистрацией и онбордингом. Выключен. */
export function VerifyEmailPage({ email, onOtherEmail }: { email: string; onOtherEmail: () => void }) {
  const timer = useResendTimer();
  const resend = async () => {
    try {
      await pb.collection("users").requestVerification(email);
    } catch {
      /* ответ одинаковый */
    }
    timer.restart();
  };
  return (
    <AuthLayout title="Подтверди почту" subtitle={`Мы отправили письмо на ${email}. Нажми на ссылку в нём, и аккаунт заработает.`}>
      <div className="c-auth-form">
        <p className="c-auth-note">Не пришло? Проверь «Спам».</p>
        <Button variant="secondary" size="lg" disabled={timer.left > 0} onClick={() => void resend()}>
          Отправить ещё раз
        </Button>
        <button type="button" className="c-auth-back" onClick={onOtherEmail}>
          Указать другую почту
        </button>
      </div>
    </AuthLayout>
  );
}
