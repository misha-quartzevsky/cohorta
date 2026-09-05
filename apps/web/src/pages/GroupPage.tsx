/**
 * ============================================
 *  GroupPage.tsx — экран «Моя группа» (/s/:sem/group)
 * ============================================
 *
 * Порядок на экране (DESIGN.md §7.1 — против фрагментации потока):
 *   1. «Есть код приглашения?» — первым, самое заметное действие.
 *   2. «Создать свою группу» — вторым, приглушённым. Ввод названия
 *      прогоняется через обязательный fuzzy-поиск существующих групп;
 *      при совпадении сверху предлагается «Присоединиться к «…»»,
 *      а создание превращается в неприметное «Всё равно создать новую».
 *   3. Мои группы: код-приглашение + ростер участников.
 *
 * Этап A: без превью конспектов и точечного шеринга.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Copy, Check, Users } from "lucide-react";

import Header from "../components/Header";
import SemesterGate from "../components/SemesterGate";
import LoadingState from "../components/LoadingState";
import ErrorBanner from "../components/ErrorBanner";
import { useMode } from "../lib/modeContext";
import { useAuth } from "../hooks/useAuth";
import { useMyGroups, useRoster } from "../hooks/useGroups";
import {
  createGroup,
  joinByInviteCode,
  joinGroupById,
  searchSimilarGroups,
  leaveGroup,
  type GroupCandidate,
} from "../services/groupService";
import { errorMessage, userName } from "../lib/format";
import {
  type Group,
  type GroupMember,
  groupName,
  groupOwnerId,
  memberUserId,
} from "../lib/types";

function inviteLink(code: string): string {
  return `${window.location.origin}/login?invite=${code}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="group-copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked — nothing to do */
        }
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Скопировано" : label}
    </button>
  );
}

function GroupCard({ group, meId }: { group: Group; meId: string }) {
  const navigate = useNavigate();
  const { roster, loading } = useRoster(group.id);
  const isOwner = groupOwnerId(group) === meId;

  return (
    <div className="group-card">
      <div className="group-card-head">
        <h3 className="group-card-name">{groupName(group)}</h3>
        {isOwner ? (
          <span className="group-badge">Вы владелец</span>
        ) : (
          <button
            type="button"
            className="group-leave-btn"
            onClick={async () => {
              await leaveGroup(group.id);
              navigate(0);
            }}
          >
            Покинуть
          </button>
        )}
      </div>

      <div className="group-invite-row">
        <span className="group-invite-label">Ссылка-приглашение</span>
        <code className="group-invite-code">{inviteLink(group.invite_code)}</code>
        <CopyButton text={inviteLink(group.invite_code)} label="Копировать" />
      </div>

      <div className="group-roster">
        <div className="group-roster-head">
          <Users size={14} />
          <span>Участники: {loading ? "…" : roster.length}</span>
        </div>
        <ul className="group-roster-list">
          {roster.map((m: GroupMember) => {
            const u = m.expand?.user;
            const name = u ? userName(u) : memberUserId(m);
            return (
              <li key={m.id} className="group-roster-item">
                <span className="group-roster-name">{name}</span>
                {memberUserId(m) === groupOwnerId(group) && (
                  <span className="group-tag">владелец</span>
                )}
                {memberUserId(m) === meId && (
                  <span className="group-tag">вы</span>
                )}
                {/* TODO(этап B): счётчик написанных лекций (нужно lectures.owner). */}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function GroupPageInner() {
  const { semesterSlug: sem } = useParams();
  const { isGroup } = useMode();
  const { user } = useAuth();
  const meId = user?.id ?? "";

  const { groups, loading, error, refetch } = useMyGroups();

  // --- join by invite code ---
  const [code, setCode] = useState("");
  const [joinErr, setJoinErr] = useState("");
  const [joining, setJoining] = useState(false);

  const join = async () => {
    if (!code.trim()) return;
    setJoining(true);
    setJoinErr("");
    try {
      await joinByInviteCode(code.trim());
      setCode("");
      await refetch();
    } catch (e) {
      setJoinErr(errorMessage(e));
    } finally {
      setJoining(false);
    }
  };

  // --- create group (with mandatory fuzzy pre-search) ---
  const [name, setName] = useState("");
  const [candidates, setCandidates] = useState<GroupCandidate[]>([]);
  const [searchRan, setSearchRan] = useState(false);
  const [searching, setSearching] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [creating, setCreating] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    const q = name.trim();
    if (q.length < 2) {
      setCandidates([]);
      setSearchRan(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchRan(false);
    const t = setTimeout(async () => {
      try {
        const found = await searchSimilarGroups(q);
        if (seq === searchSeq.current) {
          setCandidates(found);
          setSearchRan(true);
        }
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [name]);

  const joinCandidate = async (id: string) => {
    setCreating(true);
    setCreateErr("");
    try {
      await joinGroupById(id);
      setName("");
      setCandidates([]);
      await refetch();
    } catch (e) {
      setCreateErr(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const doCreate = async () => {
    if (!name.trim() || !searchRan) return;
    setCreating(true);
    setCreateErr("");
    try {
      await createGroup(name.trim());
      setName("");
      setCandidates([]);
      await refetch();
    } catch (e) {
      setCreateErr(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const crumbs = useMemo(
    () => [
      { label: "Рабочий стол", to: `/s/${sem}` },
      { label: "Группа" },
    ],
    [sem]
  );

  if (!isGroup) return <Navigate to={`/s/${sem}`} replace />;

  return (
    <>
      <Header crumbs={crumbs} />
      <div className="page">
        <h1 className="page-title">Моя группа</h1>

        {/* 1. Есть код приглашения? */}
        <section className="group-section group-join">
          <label className="group-field-label" htmlFor="group-invite-input">
            Есть код приглашения?
          </label>
          <div className="group-join-row">
            <input
              id="group-invite-input"
              className="group-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Вставьте код или ссылку"
              onKeyDown={(e) => {
                if (e.key === "Enter") void join();
              }}
            />
            <button
              type="button"
              className="group-primary-btn"
              onClick={join}
              disabled={joining || !code.trim()}
            >
              Присоединиться
            </button>
          </div>
          {joinErr && <p className="group-error">{joinErr}</p>}
        </section>

        {/* 2. Создать свою группу — второстепенное действие */}
        <section className="group-section group-create">
          <label className="group-field-label" htmlFor="group-name-input">
            Создать свою группу
          </label>
          <input
            id="group-name-input"
            className="group-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название потока, например «МК-31»"
          />

          {name.trim().length >= 2 && (
            <div className="group-create-body">
              {searching && (
                <p className="group-hint">Ищем существующие группы…</p>
              )}

              {searchRan && candidates.length > 0 && (
                <div className="group-candidates">
                  <p className="group-hint">
                    Уже есть похожие группы — присоединитесь, чтобы не дробить
                    поток:
                  </p>
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="group-candidate"
                      onClick={() => joinCandidate(c.id)}
                      disabled={creating}
                    >
                      Присоединиться к «{c.name}»
                    </button>
                  ))}
                </div>
              )}

              {searchRan && (
                <button
                  type="button"
                  className={
                    candidates.length > 0
                      ? "group-create-anyway"
                      : "group-primary-btn"
                  }
                  onClick={doCreate}
                  disabled={creating}
                >
                  {candidates.length > 0
                    ? "Всё равно создать новую"
                    : `Создать группу «${name.trim()}»`}
                </button>
              )}
            </div>
          )}
          {createErr && <p className="group-error">{createErr}</p>}
        </section>

        {/* 3. Мои группы */}
        <section className="group-section">
          <h2 className="group-subtitle">Мои группы</h2>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorBanner message={error} />
          ) : groups.length === 0 ? (
            <p className="group-empty">
              Вы пока не состоите ни в одной группе.
            </p>
          ) : (
            <div className="group-list">
              {groups.map((g) => (
                <GroupCard key={g.id} group={g} meId={meId} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default function GroupPage() {
  return (
    <SemesterGate>
      <GroupPageInner />
    </SemesterGate>
  );
}
