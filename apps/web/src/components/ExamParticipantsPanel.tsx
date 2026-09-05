/**
 * ============================================
 *  ExamParticipantsPanel.tsx — «Участники» коллективного экзамена
 * ============================================
 *
 * Фундамент коллективных экзаменов (P1 этап C ч.2):
 *  - организатор (exam.owner) открывает коллективную подготовку
 *    и вручную добавляет участников из ростера своих групп;
 *  - участник видит список и подсказку про Proof-of-Knowledge.
 *
 * Назначение билетов участникам и множественные параллельные
 * экзамены на курс — следующий шаг (пока не сделано).
 */

import { useEffect, useMemo, useState } from "react";
import { X, UserPlus } from "lucide-react";

import { useMode } from "../lib/modeContext";
import { useAuth } from "../hooks/useAuth";
import {
  fetchParticipants,
  addParticipant,
  removeParticipant,
  setExamMode,
} from "../services/examService";
import {
  fetchShareCandidates,
  type ShareCandidate,
} from "../services/shareService";
import { type Exam, type ExamParticipant } from "../lib/types";
import { userName } from "../lib/format";

interface Props {
  exam: Exam;
  /** Вызывается после смены режима экзамена (родитель перечитывает). */
  onChanged: () => void;
}

export default function ExamParticipantsPanel({ exam, onChanged }: Props) {
  const { isGroup } = useMode();
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const isOwner = String(exam.owner ?? "") === meId;
  const isCollective = exam.mode === "group";

  const [participants, setParticipants] = useState<ExamParticipant[]>([]);
  const [candidates, setCandidates] = useState<ShareCandidate[]>([]);
  const [busy, setBusy] = useState("");

  const reload = async () => {
    const p = await fetchParticipants(exam.id);
    setParticipants(p);
    if (isOwner) setCandidates(await fetchShareCandidates());
  };

  useEffect(() => {
    if (isCollective) void reload();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id, isCollective, isOwner]);

  const takenIds = useMemo(
    () => new Set(participants.map((p) => String(p.user))),
    [participants]
  );
  const pickable = candidates.filter((c) => !takenIds.has(c.id));

  if (!isGroup) return null;

  if (!isCollective) {
    if (!isOwner) return null;
    return (
      <div className="widget">
        <div className="widget-head">
          <h3 className="widget-title">Коллективная подготовка</h3>
        </div>
        <p className="widget-empty">
          Позовите одногруппников готовиться к этому экзамену вместе —
          каждый закрывает свои билеты, ответы открываются после вклада.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy === "mode"}
          onClick={async () => {
            setBusy("mode");
            try {
              await setExamMode(exam.id, "group");
              onChanged();
            } finally {
              setBusy("");
            }
          }}
        >
          Открыть коллективную подготовку
        </button>
      </div>
    );
  }

  return (
    <div className="widget">
      <div className="widget-head">
        <h3 className="widget-title">Участники</h3>
      </div>

      {participants.length === 0 ? (
        <p className="widget-empty">
          {isOwner
            ? "Добавьте участников из своей группы."
            : "Список участников пуст."}
        </p>
      ) : (
        <ul className="exam-part-list">
          {participants.map((p) => {
            const u = p.expand?.user;
            return (
              <li key={p.id} className="exam-part-row">
                <span>{u ? userName(u) : String(p.user)}</span>
                {isOwner && String(p.user) !== meId && (
                  <button
                    type="button"
                    className="exam-part-x"
                    aria-label="Убрать участника"
                    disabled={busy === p.id}
                    onClick={async () => {
                      setBusy(p.id);
                      try {
                        await removeParticipant(p.id);
                        await reload();
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isOwner && pickable.length > 0 && (
        <div className="exam-part-add">
          {pickable.map((c) => (
            <button
              key={c.id}
              type="button"
              className="exam-part-add-btn"
              disabled={busy === c.id}
              onClick={async () => {
                setBusy(c.id);
                try {
                  await addParticipant(exam.id, c.id);
                  await reload();
                } finally {
                  setBusy("");
                }
              }}
            >
              <UserPlus size={13} /> {c.name}
            </button>
          ))}
        </div>
      )}

      {!isOwner && (
        <p className="widget-empty exam-part-hint">
          Ответы участников открываются после того, как вы заполните ответ
          на свой назначенный билет.
        </p>
      )}
    </div>
  );
}
