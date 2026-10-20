/**
 * Сигнал «лекции изменились» (перенос, копия, переименование): списки и счётчики
 * в сайдбаре подписываются и перечитывают данные, не дожидаясь перезагрузки.
 */

import { useEffect } from "react";

const EVENT = "cohorta:lectures-changed";

export function notifyLecturesChanged(): void {
  window.dispatchEvent(new Event(EVENT));
}

export function useLecturesChanged(onChange: () => void): void {
  useEffect(() => {
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [onChange]);
}
