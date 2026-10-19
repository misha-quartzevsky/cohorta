import { useSaveStatus } from "../lib/saveStatus";
import { Icon } from "../ui";

const TEXT = {
  offline: "Нет связи. Изменения сохранены на этом устройстве и отправятся, когда связь вернётся. Не закрывай вкладку.",
  failed: "Не удалось сохранить. Лекция ещё не отправлена на сервер. Не закрывай вкладку и проверь связь.",
  restored: "Связь вернулась, всё сохранено.",
} as const;

/** Полоса вверху страницы (Screen-session-states, блок 3). */
export default function SaveStatusBanner() {
  const status = useSaveStatus();
  if (status === "ok") return null;
  return (
    <div className={`c-save-banner ${status}`} role={status === "failed" ? "alert" : "status"}>
      {status !== "restored" ? <Icon name="alert" size={18} /> : null}
      <span>{TEXT[status]}</span>
    </div>
  );
}
