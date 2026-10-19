import { useNavigate } from "react-router-dom";

import { Button } from "../ui";

/** «Такой страницы нет» (Screen-session-states, блок 2): удалённые лекции и чужие ссылки без доступа. */
export default function NotFoundPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  return (
    <main className={`c-notfound${embedded ? " embedded" : ""}`}>
      <div className="c-notfound-card">
        <span className="code">404</span>
        <h1>Такой страницы нет</h1>
        <p>Возможно, лекцию удалили, или у тебя нет доступа. Проверь ссылку или вернись на главную.</p>
        <Button variant="primary" size="lg" onClick={() => navigate("/", { replace: true })}>
          На главную
        </Button>
      </div>
    </main>
  );
}
