/**
 * ============================================
 *  ShareToGroupButton.tsx — «Показать группе» на лекции
 * ============================================
 *
 * Осознанное действие из УЖЕ написанной лекции: привязать её к
 * группе (`lectures.group`). Серверный хук заводит thumbnail-строку,
 * если автор включил `preview_enabled`. Полный `content` при этом
 * закрыт (виден автору и по `lecture_shares` — этап C).
 *
 * Видна только в режиме «Группа», только автору лекции, только если
 * пользователь состоит хотя бы в одной группе. При создании лекции
 * ничего не спрашивается — это отдельный шаг.
 */

import { useState } from "react";
import { Users, X } from "lucide-react";

import { useMode } from "../lib/modeContext";
import { useAuth } from "../hooks/useAuth";
import { useMyGroups } from "../hooks/useGroups";
import {
  showLectureToGroup,
  hideLectureFromGroup,
} from "../services/lectureService";
import {
  type Lecture,
  groupName,
  lectureOwnerId,
  lectureGroupId,
} from "../lib/types";

interface Props {
  lecture: Lecture;
  /** Called after the lecture's group changes so the parent can refetch. */
  onChanged?: () => void;
}

export default function ShareToGroupButton({ lecture, onChanged }: Props) {
  const { isGroup } = useMode();
  const { user } = useAuth();
  const { groups } = useMyGroups(isGroup);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const meId = user?.id ?? "";
  const ownerId = lectureOwnerId(lecture);
  const canShare = isGroup && (ownerId === meId || ownerId === "");
  if (!canShare || groups.length === 0) return null;

  const currentGroupId = lectureGroupId(lecture);
  const currentGroup = groups.find((g) => g.id === currentGroupId);

  const assign = async (groupId: string) => {
    setBusy(true);
    try {
      await showLectureToGroup(lecture.id, groupId);
      setOpen(false);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const unassign = async () => {
    setBusy(true);
    try {
      await hideLectureFromGroup(lecture.id);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  if (currentGroupId) {
    return (
      <span className="share-group-chip" title="Показана группе">
        <Users size={13} />
        {currentGroup ? groupName(currentGroup) : "в группе"}
        <button
          type="button"
          className="share-group-chip-x"
          onClick={unassign}
          disabled={busy}
          aria-label="Убрать из группы"
        >
          <X size={12} />
        </button>
      </span>
    );
  }

  return (
    <div className="share-group">
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((v) => !v)}
        title="Показать группе"
        aria-label="Показать группе"
        disabled={busy}
      >
        <Users size={15} />
      </button>
      {open && (
        <div className="share-group-menu" role="menu">
          <p className="share-group-menu-title">Показать группе</p>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className="share-group-menu-item"
              onClick={() => assign(g.id)}
              disabled={busy}
            >
              {groupName(g)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
