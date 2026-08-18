/**
 * ============================================
 *  Login.tsx — Sign-in Page
 * ============================================
 *
 * Minimal email/password form inside a centered
 * glassmorphism card.  After a successful sign-in
 * redirects back to the originally requested page
 * (passed via `location.state.from`).
 */

import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "../hooks/useAuth";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isValid, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already signed in — straight to the dashboard.
  if (isValid) return <Navigate to="/" replace />;

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError("");
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      console.error("Ошибка входа:", err);
      setError("Не удалось войти. Проверьте email и пароль.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="login-logo" src="/cohorta-black.svg" alt="Cohorta" />

        <h1 className="login-title">Вход в Cohorta</h1>
        <p className="login-subtitle">
          Конспекты, курсы и заметки — всё в одном месте
        </p>

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
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting && <Loader2 size={18} className="spin" />}
            {submitting ? "Вход…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;