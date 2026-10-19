import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Icon, Modal } from "../../ui";
import {
  ackReady,
  cancelCreate,
  closeDialog,
  setSize,
  startCreate,
  useCreation,
} from "../../lib/quizCreation";
import { QUIZ_MIN_CHARS, QUIZ_SIZES } from "../../lib/quizLimits";
import { pluralRu } from "../../lib/format";
import type { Lecture } from "../../lib/types";

interface Props {
  lecture: Lecture;
  /** Знаков в конспекте сейчас. */
  charCount: number;
  /** Есть ли у лекции уже собранный квиз — для кнопки «Мои готовые квизы». */
  hasQuiz: boolean;
}

/**
 * Окна создания квиза (Screen-quiz-states блоки 1–5, телефон —
 * Screen-m-quiz-1/2/3): размер → ожидание → ошибка / мало текста / лимит.
 * На компьютере окно по центру, на телефоне шторка снизу (Modal переключает по CSS).
 */
export default function QuizCreateDialog({ lecture, charCount, hasQuiz }: Props) {
  const navigate = useNavigate();
  const st = useCreation(lecture.id);

  // Сборка закончилась при открытом окне ожидания — идём в квиз.
  useEffect(() => {
    if (st.ready) {
      ackReady(lecture.id);
      navigate(`/quiz/${lecture.id}`);
    }
  }, [st.ready, lecture.id, navigate]);

  const close = () => closeDialog(lecture.id);
  const start = () => startCreate({ lectureId: lecture.id, textLength: charCount });

  let title = "";
  let body: ReactNode = null;

  if (st.dialog === "choose") {
    title = "Создать квиз";
    body = (
      <>
        <h2 className="c-qd-title">Создать квиз</h2>
        <p className="c-qd-text c-hide-phone">«{lecture.title}». Сколько вопросов нужно?</p>
        <span className="c-qd-label">Количество вопросов</span>
        <div className="c-qd-sizes" role="radiogroup" aria-label="Количество вопросов">
          {QUIZ_SIZES.map(({ size, minutes }) => (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={st.size === size}
              className={`c-qd-size${st.size === size ? " on" : ""}`}
              onClick={() => setSize(lecture.id, size)}
            >
              <b>{size}</b>
              <span>~{minutes} мин</span>
            </button>
          ))}
        </div>
        <p className="c-qd-hint">Вопросы выбираем по всему тексту лекции, чтобы покрыть все темы.</p>
        <div className="c-qd-actions">
          <Button variant="ghost" onClick={close} className="c-hide-phone">
            Отмена
          </Button>
          <Button variant="primary" onClick={start}>
            Создать
          </Button>
        </div>
      </>
    );
  } else if (st.dialog === "waiting") {
    title = "Собираем квиз";
    body = (
      <>
        <h2 className="c-qd-title">Собираем квиз</h2>
        <p className="c-qd-text c-hide-phone">
          Читаем конспект и придумываем вопросы. Обычно это занимает до 30 секунд.
        </p>
        <p className="c-qd-text c-show-phone">
          Обычно до 30 секунд. Можно закрыть окно, квиз появится в панели лекции.
        </p>
        <div className="c-qd-progress" aria-hidden="true">
          <div />
        </div>
        <div className="c-qd-skel c-hide-phone" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <span />
              <i />
            </div>
          ))}
        </div>
        <div className="c-qd-actions">
          <Button variant="ghost" onClick={() => cancelCreate(lecture.id)} className="c-hide-phone">
            Отмена
          </Button>
          <Button variant="secondary" onClick={close} className="c-show-phone">
            Закрыть
          </Button>
        </div>
      </>
    );
  } else if (st.dialog === "error") {
    title = "Не получилось собрать квиз";
    body = (
      <>
        <span className="c-qd-icon">
          <Icon name="alert" size={22} />
        </span>
        <h2 className="c-qd-title">Не получилось собрать квиз</h2>
        <p className="c-qd-text">
          Что-то пошло не так на нашей стороне. Попытка не потрачена, можно попробовать ещё раз.
        </p>
        <div className="c-qd-actions">
          <Button variant="ghost" onClick={close}>
            Закрыть
          </Button>
          <Button variant="primary" onClick={start}>
            Попробовать снова
          </Button>
        </div>
      </>
    );
  } else if (st.dialog === "short") {
    const now = Math.min(st.textLength, QUIZ_MIN_CHARS);
    title = "В конспекте мало текста";
    body = (
      <>
        <span className="c-qd-icon">
          <Icon name="doc" size={22} />
        </span>
        <h2 className="c-qd-title">В конспекте мало текста</h2>
        <p className="c-qd-text">
          Для квиза нужно хотя бы {QUIZ_MIN_CHARS} знаков, сейчас около {st.textLength}. Допиши лекцию, и мы
          соберём вопросы.
        </p>
        <div className="c-qd-scale">
          <div>
            <span>Текста в лекции</span>
            <span>
              {st.textLength} из {QUIZ_MIN_CHARS}
            </span>
          </div>
          <div className="bar">
            <div style={{ width: `${(now / QUIZ_MIN_CHARS) * 100}%` }} />
          </div>
        </div>
        <div className="c-qd-actions">
          <Button variant="primary" onClick={close}>
            Вернуться к конспекту
          </Button>
        </div>
      </>
    );
  } else if (st.dialog === "limit") {
    title = "Лимит исчерпан";
    const counted =
      st.used !== null && st.limit !== null
        ? `${st.used} ${pluralRu(st.used, ["квиз", "квиза", "квизов"])} из ${st.limit}`
        : null;
    body = (
      <>
        <span className="c-qd-icon c-hide-phone">
          <Icon name="lock" size={22} />
        </span>
        <h2 className="c-qd-title">Лимит исчерпан</h2>
        <p className="c-qd-text c-hide-phone">
          {counted ? `Сегодня ты уже создал ${counted}.` : "Сегодня ты уже создал все квизы."} Новые можно будет
          собрать завтра после 00:00. Готовые квизы проходить можно без ограничений.
        </p>
        <p className="c-qd-text c-show-phone">
          {counted ? `Сегодня создано ${counted}.` : "Сегодня лимит исчерпан."} Новые можно собрать завтра после
          00:00. Готовые проходи без ограничений.
        </p>
        <div className="c-qd-note c-hide-phone">
          <Icon name="lock" size={18} />
          Лимит считается по созданию, не по прохождению.
        </div>
        <div className="c-qd-actions">
          <Button variant={hasQuiz ? "secondary" : "primary"} onClick={close}>
            Понятно
          </Button>
          {hasQuiz && (
            <Button
              variant="primary"
              onClick={() => {
                close();
                navigate(`/quiz/${lecture.id}`);
              }}
            >
              Мои готовые квизы
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <Modal open={st.dialog !== "closed"} onClose={close} title={title} bare className="c-quiz-dialog">
      {body}
    </Modal>
  );
}
