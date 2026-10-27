import { Link } from "react-router-dom";

import { Icon } from "../../ui";

const SECTIONS: { title: string; text: string }[] = [
  {
    title: "Что мы храним",
    text: "Твои лекции, задачи, расписание и билеты. Они лежат в твоём аккаунте и никому не видны, пока ты сам не откроешь доступ.",
  },
  {
    title: "Что видит группа",
    text: "Имя, аватар и число лекций. Названия лекций видны только при включённом предпросмотре. Текст лекции читают только те, кому ты его открыл.",
  },
  {
    title: "Экспорт и удаление",
    text: "Все данные можно скачать в настройках. Удаление аккаунта стирает лекции и доступы без возможности восстановить.",
  },
  {
    title: "Связаться с нами",
    text: "Вопросы и жалобы можно написать на почту поддержки из настроек.",
  },
];

/** Политика данных (Screen-policy). Публичная: открывается и со входа, и из профиля. */
export default function PolicyPage() {
  return (
    <main className="c-policy">
      <div className="c-policy-col">
        <Link to="/login" className="c-policy-crumb">
          Вход
          <Icon name="chev" size={14} />
        </Link>
        <h1>Политика данных</h1>
        <span className="lead">Коротко и по-человечески: что мы храним, кто это видит и как это убрать.</span>
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
