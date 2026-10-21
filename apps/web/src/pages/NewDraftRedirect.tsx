import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { notifyLecturesChanged } from "../lib/lecturesChanged";
import { errorMessage } from "../lib/format";
import { lectureSlug } from "../lib/types";
import { createDraftLecture } from "../services/lectureService";
import ErrorBanner from "../components/ErrorBanner";
import CardSkeleton from "../components/CardSkeleton";

/**
 * `/note/new` в новом интерфейсе: лекция без предмета создаётся сразу («Лекция N», в «Черновиках»)
 * и открывается в том же редакторе, что и обычная лекция. Кнопки «Сохранить» нет: работает
 * автосохранение.
 */
export default function NewDraftRedirect() {
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createDraftLecture()
      .then((created) => {
        notifyLecturesChanged();
        navigate(`/note/${lectureSlug(created)}/edit`, { replace: true });
      })
      .catch((e) => setError("Не удалось создать лекцию: " + errorMessage(e)));
  }, [navigate]);

  return error ? <ErrorBanner message={error} /> : <CardSkeleton />;
}
