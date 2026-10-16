/** Открыть нативный <select> программно (клик по кастомному триггеру). */
export function openSelect(el: HTMLSelectElement | null) {
  if (!el) return;
  const withPicker = el as HTMLSelectElement & { showPicker?: () => void };
  if (withPicker.showPicker) withPicker.showPicker();
  else el.click();
}
