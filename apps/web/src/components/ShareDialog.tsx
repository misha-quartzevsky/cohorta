/**
 * ============================================
 *  ShareDialog.tsx — «Доступ» к лекции (lecture_shares)
 * ============================================
 *
 * Паттерн Google Docs: список тех, у кого уже есть полный доступ
 * (крестик = мгновенный индивидуальный отзыв), плюс поиск/выбор
 * участников групп для выдачи нового доступа.
 *
 * НЕ общий тумблер «открыто/закрыто» — только точечные выдачи.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, UserPlus } from "lucide-react";

import {
  fetchShares,
  grantAccess,
  revokeAccess,
  fetchShareCandidates,
  type ShareCandidate,
} from "../services/shareService";
import type { LectureShare } from "../lib/types";
import { userName } from "../lib/format";

interface Props {
  lectureId: string;
  onClose: () => void;
}

export default function ShareDialog({ lectureId, onClose }: Props) {
  const [shares, setShares] = useState<LectureShare[]>([]);
  const [candidates, setCandidates] = useState<ShareCandidate[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [s, c] = await Promise.all([
      fetchShares(lectureId),
      fetchShareCandidates(),
    ]);
    setShares(s);
    setCandidates(c);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // reload пересоздаётся каждый рендер; перезагружать нужно только при
    // смене лекции — ключ зависимости именно lectureId.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureId]);

  const grantedIds = useMemo(
    () => new Set(shares.map((s) => String(s.grantee))),
    [shares]
  );

  const pickable = candidates.filter(
    (c) =>
      !grantedIds.has(c.id) &&
      (query.trim() === "" ||
        c.name.toLowerCase().includes(query.trim().toLowerCase()))
  );

  const grant = async (id: string) => {
    setBusy(id);
    try {
      await grantAccess(lectureId, id);
      await reload();
    } finally {
      setBusy("");
    }
  };

  const revoke = async (shareId: string) => {
    setBusy(shareId);
    try {
      await revokeAccess(shareId);
      await reload();
    } finally {
      setBusy("");
    }
  };

  return createPortal(
    <div className="confirm-backdrop" onClick={onClose}>
      <div
        className="confirm-content share-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="confirm-close"
          onClick={onClose}
          aria-label="Закрыть"
          type="button"
        >
          <X size={18} />
        </button>

        <h3 className="confirm-title">Доступ к записи</h3>

        {loading ? (
          <p className="share-dialog-hint">Загрузка…</p>
        ) : (
          <>
            <p className="share-dialog-section">Есть доступ</p>
            {shares.length === 0 ? (
              <p className="share-dialog-hint">
                Пока доступ никому не выдан — запись видите только вы.
              </p>
            ) : (
              <ul className="share-dialog-list">
                {shares.map((s) => (
                  <li key={s.id} className="share-dialog-row">
                    <span>
                      {s.expand?.grantee
                        ? userName(s.expand.grantee)
                        : String(s.grantee)}
                    </span>
                    <button
                      type="button"
                      className="share-dialog-x"
                      onClick={() => revoke(s.id)}
                      disabled={busy === s.id}
                      aria-label="Отозвать доступ"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="share-dialog-section">Выдать доступ</p>
            <input
              className="share-dialog-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти участника группы"
            />
            {pickable.length === 0 ? (
              <p className="share-dialog-hint">
                {candidates.length === 0
                  ? "Сначала вступите в группу с одногруппниками."
                  : "Никого не найдено."}
              </p>
            ) : (
              <ul className="share-dialog-list">
                {pickable.map((c) => (
                  <li key={c.id} className="share-dialog-row">
                    <span>{c.name}</span>
                    <button
                      type="button"
                      className="share-dialog-add"
                      onClick={() => grant(c.id)}
                      disabled={busy === c.id}
                    >
                      <UserPlus size={14} /> Дать доступ
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
