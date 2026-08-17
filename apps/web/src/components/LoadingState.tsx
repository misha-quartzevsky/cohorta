/**
 * ============================================
 *  LoadingState.tsx
 * ============================================
 *
 * Simple full-viewport loading placeholder.
 * Shown while data is being fetched from
 * PocketBase.
 */

interface Props {
  /** Text to display while loading. Defaults to "Загрузка…" */
  text?: string;
}

/**
 * Renders an empty-state styled loading indicator.
 *
 * @param Props.text — optional label shown inside the loader
 */
function LoadingState({ text = "Загрузка…" }: Props) {
  return <div className="empty">{text}</div>;
}

export default LoadingState;