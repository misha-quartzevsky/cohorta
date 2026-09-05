/**
 * ============================================
 *  PrivacyPage.tsx — политика данных (плейсхолдер)
 * ============================================
 *
 * Публичная страница (доступна и из /login, и из профиля).
 * Текст политики — отдельная, не техническая задача.
 */

import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="privacy-page">
      <div className="privacy-card">
        <Link to="/" className="privacy-back">
          <ArrowLeft size={15} /> Назад
        </Link>
        <h1 className="privacy-title">Политика данных</h1>
        <p className="privacy-text">
          Cohorta хранит только то, что вы создаёте сами: курсы, конспекты,
          карточки и билеты. Мы не передаём эти данные третьим лицам.
        </p>
        <p className="privacy-text">
          Вы можете запросить удаление аккаунта и всех связанных данных из
          своего профиля — запрос обрабатывается вручную, мы свяжемся с вами
          по email.
        </p>
        <p className="privacy-text privacy-muted">
          Полный текст политики готовится.
        </p>
      </div>
    </div>
  );
}
