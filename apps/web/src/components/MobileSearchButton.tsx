/**
 * Лупа справа сверху на корневых экранах телефона (Главная, Расписание, Лекции, Занятия):
 * без рамки, значок 22 px, зона нажатия 44 px. На компьютере скрыта (поиск в сайдбаре).
 * Если рядом есть «+», лупа правее него.
 */

import { Icon } from "../ui";
import { useUiShell } from "../lib/uiShellContext";

export default function MobileSearchButton() {
  const { openSearch } = useUiShell();
  return (
    <button type="button" className="c-search-m" aria-label="Поиск" onClick={openSearch}>
      <Icon name="search" size={22} />
    </button>
  );
}
