import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Icon, Input } from "../../ui";
import { lastSemesterSlug } from "../../lib/lastSemester";

/**
 * Вступление (Screen-group-join): «Вступи в свою группу». Найти группу ведёт на подтверждение
 * `/join/КОД` (Screen-group-join-confirm), создать свою — на `/s/…/group/new`.
 */
export default function GroupJoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const sem = lastSemesterSlug() || "1";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (c) navigate(`/join/${encodeURIComponent(c)}`);
  };

  return (
    <div className="c-gr-center">
      <span className="c-gr-ic" aria-hidden="true">
        <Icon name="people" size={24} />
      </span>
      <h1>Вступи в свою группу</h1>
      <p className="lead">
        В группе видно одногруппников и можно готовиться к экзамену вместе. Твои лекции остаются личными, пока ты сам не откроешь доступ.
      </p>
      <form className="c-gr-box" onSubmit={submit}>
        <div className="c-gr-field">
          <label htmlFor="gr-code">Код группы</label>
          <div className="row">
            <Input
              id="gr-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Например, MK31-7X4P"
              autoComplete="off"
              autoCapitalize="characters"
            />
            <Button type="submit" variant="secondary" disabled={!code.trim()}>
              Найти группу
            </Button>
          </div>
        </div>
        <p className="c-gr-hint">Код есть у старосты и у любого одногруппника. Или просто открой ссылку-приглашение.</p>
      </form>
      <div className="c-gr-or">или</div>
      <Button className="c-gr-or-btn" variant="secondary" onClick={() => navigate(`/s/${sem}/group/new`)}>
        Создать свою группу
      </Button>
    </div>
  );
}
