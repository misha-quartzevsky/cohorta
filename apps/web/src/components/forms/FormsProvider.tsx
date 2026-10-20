import { useMemo, useState, type ReactNode } from "react";
import { FormsContext, type FormsApi } from "../../lib/formsContext";
import SubjectFormDialog from "./SubjectFormDialog";
import DeckFormDialog from "./DeckFormDialog";
import ExamFormDialog from "./ExamFormDialog";

/** Окна «Новый предмет», «Новая колода» и «Новый экзамен» живут один раз в каркасе и открываются с любого экрана. */
export default function FormsProvider({ children }: { children: ReactNode }) {
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [examSubject, setExamSubject] = useState<string | undefined>();
  const api = useMemo<FormsApi>(
    () => ({
      openSubjectForm: () => setSubjectOpen(true),
      openDeckForm: () => setDeckOpen(true),
      openExamForm: (subjectId) => {
        setExamSubject(subjectId);
        setExamOpen(true);
      },
    }),
    []
  );
  return (
    <FormsContext.Provider value={api}>
      {children}
      <SubjectFormDialog open={subjectOpen} onClose={() => setSubjectOpen(false)} />
      <DeckFormDialog open={deckOpen} onClose={() => setDeckOpen(false)} />
      <ExamFormDialog
        open={examOpen}
        onClose={() => setExamOpen(false)}
        defaultSubjectId={examSubject}
        onAddSubject={() => setSubjectOpen(true)}
      />
    </FormsContext.Provider>
  );
}
