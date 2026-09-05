/**
 * ============================================
 *  ShareAccessButton.tsx — кнопка «Доступ» на лекции
 * ============================================
 *
 * Открывает диалог точечной выдачи полного доступа к лекции
 * (lecture_shares). Видна только в режиме «Группа», только автору
 * лекции, только если он состоит хотя бы в одной группе.
 */

import { useState } from "react";
import { UserRoundCog } from "lucide-react";

import { useMode } from "../lib/modeContext";
import { useAuth } from "../hooks/useAuth";
import { useMyGroups } from "../hooks/useGroups";
import { type Lecture, lectureOwnerId } from "../lib/types";
import ShareDialog from "./ShareDialog";

interface Props {
  lecture: Lecture;
}

export default function ShareAccessButton({ lecture }: Props) {
  const { isGroup } = useMode();
  const { user } = useAuth();
  const { groups } = useMyGroups(isGroup);
  const [open, setOpen] = useState(false);

  const meId = user?.id ?? "";
  const ownerId = lectureOwnerId(lecture);
  const canShare = isGroup && (ownerId === meId || ownerId === "");

  if (!canShare || groups.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen(true)}
        title="Доступ"
        aria-label="Доступ к записи"
      >
        <UserRoundCog size={15} />
      </button>
      {open && (
        <ShareDialog lectureId={lecture.id} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
