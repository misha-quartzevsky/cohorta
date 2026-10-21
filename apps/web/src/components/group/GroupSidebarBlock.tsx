import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Icon, Popover } from "../../ui";
import { useGroupCtx } from "../../lib/groupCtx";
import { groupInitials, type GroupSummary } from "../../services/groupApi";
import { pluralRu } from "../../lib/format";
import { useNotify } from "../../lib/notifyCtx";

export function studentsLabel(n: number): string {
  return `${n} ${pluralRu(n, ["студент", "студента", "студентов"])}`;
}

function requestsLabel(n: number): string {
  return `${n} ${pluralRu(n, ["запрос", "запроса", "запросов"])}`;
}

/** Список групп с галочкой у текущей и «Вступить в ещё одну» — общий для компьютера и телефона. */
export function GroupList({ semSlug, onPick }: { semSlug: string; onPick: () => void }) {
  const { groups, current, select } = useGroupCtx();
  const navigate = useNavigate();
  return (
    <div className="c-gr-switch-list">
      {groups.map((g: GroupSummary) => {
        const on = g.group.id === current?.group.id;
        return (
          <button
            key={g.group.id}
            type="button"
            className={`c-gr-switch-row${on ? " on" : ""}`}
            onClick={() => {
              select(g.group.id);
              onPick();
              navigate(`/s/${semSlug}/group`);
            }}
          >
            <span className={`c-gr-mark${on ? " dark" : ""}`}>{groupInitials(g.group.name)}</span>
            <span className="tx">
              <span className="name">{g.group.name}</span>
              <span className="sub">
                {studentsLabel(g.members)}
                {g.openRequests > 0 ? ` · ${requestsLabel(g.openRequests)}` : ""}
              </span>
            </span>
            {on && <Icon name="check" size={18} className="ck" />}
          </button>
        );
      })}
      <div className="c-gr-switch-sep" />
      <button
        type="button"
        className="c-gr-switch-row add"
        onClick={() => {
          onPick();
          navigate(`/s/${semSlug}/group/join`);
        }}
      >
        <Icon name="plus" size={18} />
        <span className="name">Вступить в ещё одну</span>
      </button>
    </div>
  );
}

/** Карточка группы в сайдбаре (Screen-group-switcher) и разделы режима «Группа». */
export default function GroupSidebarBlock({ semSlug, onNavigate }: { semSlug: string; onNavigate: () => void }) {
  const { groups, current, requestsTotal } = useGroupCtx();
  const { dots } = useNotify();
  const [open, setOpen] = useState(false);
  if (!current || groups.length === 0) return null;
  const g = current;
  return (
    <>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        className="c-gr-switch-pop"
        trigger={
          <button type="button" className="c-gr-card" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span className="c-gr-mark dark">{groupInitials(g.group.name)}</span>
            <span className="tx">
              <span className="name">{g.group.name}</span>
              <span className="sub">{studentsLabel(g.members)}</span>
            </span>
            <Icon name="chevd" size={18} />
          </button>
        }
      >
        <GroupList semSlug={semSlug} onPick={() => setOpen(false)} />
      </Popover>
      <nav className="c-shell-nav c-gr-nav" aria-label="Разделы группы">
        <NavLink to={`/s/${semSlug}/group`} end onClick={onNavigate} className={({ isActive }) => (isActive ? "on" : "")}>
          <Icon name="people" size={20} />
          <span className="label">Одногруппники</span>
        </NavLink>
        <NavLink to={`/s/${semSlug}/group/access`} onClick={onNavigate} className={({ isActive }) => (isActive ? "on" : "")}>
          <Icon name="lock" size={20} />
          <span className="label">Мой доступ</span>
          {requestsTotal > 0 && <span className="count">{requestsTotal}</span>}
          {dots.access && <i className="c-gr-dot" aria-label="Есть новое" />}
        </NavLink>
        <NavLink to={`/s/${semSlug}/group/exams`} onClick={onNavigate} className={({ isActive }) => (isActive ? "on" : "")}>
          <Icon name="exam" size={20} />
          <span className="label">Экзамены группы</span>
          {dots.exams && <i className="c-gr-dot" aria-label="Есть новое" />}
        </NavLink>
      </nav>
    </>
  );
}
