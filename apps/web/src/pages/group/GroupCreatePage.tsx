import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../../ui";
import { Crumbs, useSem } from "../../components/group/common";
import { useGroupCtx } from "../../lib/groupCtx";
import { createGroupApi } from "../../services/groupApi";
import { errorMessage } from "../../lib/format";
import { useEffect } from "react";
import { useMode } from "../../lib/modeContext";

/**
 * Новая группа (Screen-group-create). Код приглашения ставит сервер при создании,
 * поэтому до создания он не показывается; ссылка у новой группы закрыта, владелец открывает её
 * кнопкой «Пригласить» или в настройках.
 */
export default function GroupCreatePage() {
  const navigate = useNavigate();
  const sem = useSem();
  const { refresh, select } = useGroupCtx();
  const { setMode } = useMode();
  useEffect(() => setMode("group"), [setMode]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const g = await createGroupApi(name);
      await refresh();
      select(g.id);
      navigate(`/s/${sem}/group?invite=1`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form className="c-gr-center" onSubmit={submit}>
      <Crumbs items={[{ label: "Вступить", to: `/s/${sem}/group/join` }, { label: "Создать группу" }]} />
      <h1 style={{ marginTop: 16 }}>Новая группа</h1>
      <div className="c-gr-box" style={{ marginTop: 20 }}>
        <div className="c-gr-field">
          <label htmlFor="gr-name">Название</label>
          <Input id="gr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" error={error || undefined} />
        </div>
        <div className="c-gr-field">
          <label>Код для одногруппников</label>
          <div className="row">
            <div className="c-gr-codebox mute">Появится после создания</div>
            <Button variant="secondary" disabled>
              Скопировать
            </Button>
          </div>
        </div>
        <p className="c-gr-hint">Код можно сменить позже, если он попал не туда.</p>
        <div className="c-gr-note">Вступление ничего не открывает. Каждый сам решает, что показать группе.</div>
      </div>
      <div className="c-gr-actions">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Отмена
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={!name.trim()} loading={busy}>
          Создать группу
        </Button>
      </div>
    </form>
  );
}
