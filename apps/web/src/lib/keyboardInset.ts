/** Высота экранной клавиатуры по visualViewport (0 без неё или без поддержки). */
export function keyboardInset(win: Pick<Window, "innerHeight" | "visualViewport"> = window): number {
  const vv = win.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(win.innerHeight - vv.height - vv.offsetTop));
}
