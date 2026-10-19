import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { pb } from "../../lib/pocketbase";
import { pluralRu } from "../../lib/format";
import { useMode } from "../../lib/modeContext";
import { clearPendingInvite, savePendingInvite } from "../../lib/pendingInvite";
import { lastSemesterSlug } from "../../lib/lastSemester";
import { fetchGroupPreview, joinByInviteCode, type GroupPreview } from "../../services/groupService";
import { Button, Icon, Input } from "../../ui";

/** Флаг: после онбординга показать группу, в которую человек вступил по ссылке. */
export const LAND_IN_GROUP_KEY = "cohorta:landInGroup";

/**
 * «Вступить в группу» (Screen-group-join-confirm). Ссылка cohorta.ru/join/КОД
 * открывает его с уже введённым кодом; автовступления нет — человек видит,
 * в какую группу идёт, и подтверждает сам. Код переживает вход и регистрацию
 * (lib/pendingInvite.ts). Без сайдбара: у только что зарегистрированного
 * человека онбординг ещё не пройден.
 */
export default function JoinGroupPage() {
  const { code: codeParam = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setMode } = useMode();

  const [code, setCode] = useState(codeParam);
  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const find = async (value: string) => {
    setBusy(true);
    setError("");
    setGroup(null);
    try {
      setGroup(await fetchGroupPreview(value));
      savePendingInvite(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Группа с таким кодом не найдена.");
    } finally {
      setBusy(false);
    }
  };

  // Код из адреса — сразу найти группу.
  useEffect(() => {
    if (codeParam) {
      savePendingInvite(codeParam);
      void find(codeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) void find(code);
  };

  const join = async () => {
    if (!group) return;
    setBusy(true);
    setError("");
    try {
      await joinByInviteCode(code);
      clearPendingInvite();
      setMode("group");
      if (user?.onboarding_completed === true) {
        navigate(`/s/${lastSemesterSlug() || "1"}/group`, { replace: true });
      } else {
        try {
          localStorage.setItem(LAND_IN_GROUP_KEY, "1");
        } catch {
          /* ничего: после онбординга откроется Главная */
        }
        navigate("/", { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось вступить. Попробуй ещё раз.");
      setBusy(false);
    }
  };

  const notThis = () => {
    clearPendingInvite();
    setGroup(null);
    setCode("");
    setError("");
    if (codeParam) navigate("/join", { replace: true });
  };

  return (
    <main className="c-auth c-join">
      <div className="c-auth-col c-join-col">
        <span className="c-join-ic" aria-hidden="true">
          <Icon name="people" size={24} />
        </span>
        <div className="c-auth-head">
          <h1>Вступи в свою группу</h1>
          <span>
            В группе видно одногруппников и можно готовиться к экзамену вместе. Твои лекции остаются личными, пока ты сам
            не откроешь доступ.
          </span>
        </div>
        <div className="c-auth-card">
          <form className="c-join-find" onSubmit={onSubmit}>
            <Input
              label="Код группы"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={error || undefined}
              hint="Код есть у старосты и у любого одногруппника. Или просто открой ссылку-приглашение."
              autoCapitalize="characters"
              autoComplete="off"
            />
            <Button type="submit" variant="secondary" loading={busy && !group} disabled={!code.trim()}>
              Найти группу
            </Button>
          </form>
          {group && (
            <>
              <div className="c-join-group">
                <span className="c-join-badge" aria-hidden="true">
                  {group.name.trim().slice(0, 2).toUpperCase()}
                </span>
                <div className="tx">
                  <span className="t">{group.name}</span>
                  <span className="m">
                    {group.members} {pluralRu(group.members, ["студент", "студента", "студентов"])}
                  </span>
                  {group.owner_name ? <span className="m">Создатель группы: {group.owner_name}</span> : null}
                </div>
              </div>
              <p className="c-auth-note c-join-note">
                После вступления твои лекции для группы закрыты. Открыть предпросмотр можно в любой момент в разделе «Мой
                доступ».
              </p>
              <div className="c-join-actions">
                <Button variant="ghost" onClick={notThis} disabled={busy}>
                  Это не та группа
                </Button>
                <Button variant="primary" size="lg" onClick={() => void join()} loading={busy}>
                  Вступить в {group.name}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * Публичный вход по ссылке cohorta.ru/join/КОД: код запоминается, а человек
 * без аккаунта идёт на регистрацию (после неё и после входа его вернёт сюда).
 */
export function JoinRoute() {
  const { code = "" } = useParams();
  if (code) savePendingInvite(code);
  if (!pb.authStore.isValid) {
    return <Navigate to="/register" state={{ from: code ? `/join/${encodeURIComponent(code)}` : "/join" }} replace />;
  }
  return <JoinGroupPage />;
}
