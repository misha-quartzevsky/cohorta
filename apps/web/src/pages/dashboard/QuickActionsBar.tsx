/**
 * ============================================
 *  QuickActionsBar.tsx — панель быстрых действий
 * ============================================
 */

import { FilePlus2, Layers, Plus } from "lucide-react";

interface Props {
  onNewNote: () => void;
  onNewCourse: () => void;
  onNewDeck: () => void;
}

export default function QuickActionsBar({
  onNewNote,
  onNewCourse,
  onNewDeck,
}: Props) {
  return (
    <div className="quick-actions">
      <button type="button" className="quick-action primary" onClick={onNewNote}>
        <FilePlus2 size={17} />
        Новая заметка
      </button>
      <button type="button" className="quick-action" onClick={onNewCourse}>
        <Plus size={17} />
        Новый курс
      </button>
      <button type="button" className="quick-action" onClick={onNewDeck}>
        <Layers size={17} />
        Карточки
      </button>
    </div>
  );
}
