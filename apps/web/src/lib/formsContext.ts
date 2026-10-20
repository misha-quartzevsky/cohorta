import { createContext, useContext } from "react";

export interface FormsApi {
  /** Окно «Новый предмет»: после создания открывает страницу предмета. */
  openSubjectForm: () => void;
  /** Окно «Новая колода»: после создания открывает колоду. */
  openDeckForm: () => void;
}

export const FormsContext = createContext<FormsApi | null>(null);

/** Формы создания (B3). Вне нового каркаса вернёт null — вызывающий уходит на прежний переход. */
export function useForms(): FormsApi | null {
  return useContext(FormsContext);
}
