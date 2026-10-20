import { useMemo, useState, type ReactNode } from "react";
import { FormsContext, type FormsApi } from "../../lib/formsContext";
import SubjectFormDialog from "./SubjectFormDialog";
import DeckFormDialog from "./DeckFormDialog";

/** Окна «Новый предмет» и «Новая колода» живут один раз в каркасе и открываются с любого экрана. */
export default function FormsProvider({ children }: { children: ReactNode }) {
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const api = useMemo<FormsApi>(
    () => ({
      openSubjectForm: () => setSubjectOpen(true),
      openDeckForm: () => setDeckOpen(true),
    }),
    []
  );
  return (
    <FormsContext.Provider value={api}>
      {children}
      <SubjectFormDialog open={subjectOpen} onClose={() => setSubjectOpen(false)} />
      <DeckFormDialog open={deckOpen} onClose={() => setDeckOpen(false)} />
    </FormsContext.Provider>
  );
}
