/**
 * SaveIndicator.tsx — autosave status chip.
 *
 * Rendered from the `saveState` / `saveText` returned by useAutosave.
 * Styling lives in App.css (`.save-indicator` + `.saved` / `.error` / `.spin`).
 */

import { Loader2 } from "lucide-react";
import type { SaveState } from "../hooks/useAutosave";

interface Props {
  state: SaveState;
  text: string;
}

export default function SaveIndicator({ state, text }: Props) {
  return (
    <span className={`save-indicator ${state}`}>
      {state === "saving" && <Loader2 size={14} className="spin" />}
      {text}
    </span>
  );
}
