import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: ReactNode;
  /** Поля на карточке (десктоп); на телефоне карточки нет. */
  children: ReactNode;
  footer?: ReactNode;
  /** Регистрация уже входа: 400 px против 420 (Screen-register / Screen-login). */
  narrow?: boolean;
}

/**
 * Каркас экранов входа и регистрации (Screen-login, Screen-register,
 * Screen-m-register): логотип из SVG, заголовок, карточка с полями,
 * ссылки под ней. Один столбец, по центру.
 */
export default function AuthLayout({ title, subtitle, children, footer, narrow }: Props) {
  return (
    <main className="c-auth">
      <div className={`c-auth-col${narrow ? " c-auth-col-narrow" : ""}`}>
        <img className="c-auth-logo" src="/brand/cohorta-logo-primary.svg" alt="cohorta" />
        <div className="c-auth-head">
          <h1>{title}</h1>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        <div className="c-auth-card">{children}</div>
        {footer}
      </div>
    </main>
  );
}
