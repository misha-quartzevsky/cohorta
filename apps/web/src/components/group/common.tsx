import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { pb } from "../../lib/pocketbase";
import { useMode } from "../../lib/modeContext";
import { lastSemesterSlug } from "../../lib/lastSemester";
import { useGroupCtx } from "../../lib/groupCtx";
import { nameInitials } from "../../lib/format";
import { Icon } from "../../ui";
import GroupJoinPage from "../../pages/group/GroupJoinPage";

export function useSem(): string {
  const { semesterSlug } = useParams();
  return semesterSlug || lastSemesterSlug() || "1";
}

/** Аватар человека: фото, если есть, иначе инициалы. */
export function Ava({ id, name, avatar, size = "" }: { id: string; name: string; avatar?: string; size?: "" | "sm" | "xs" | "lg" }) {
  const src = avatar ? pb.files.getURL({ collectionName: "users", id }, avatar) : "";
  return (
    <span className={`c-gr-ava${size ? ` ${size}` : ""}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : nameInitials(name)}
    </span>
  );
}

export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="c-gr-crumbs" aria-label="Путь">
      {items.map((it, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <Icon name="chev" size={14} />}
          {it.to ? <Link to={it.to}>{it.label}</Link> : <span>{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/**
 * Экраны режима «Группа»: открытие такого адреса включает режим, а человеку без группы
 * показывается «Вступи в свою группу» (Screen-group-join).
 */
export function GroupGate({ children }: { children: ReactNode }) {
  const { setMode } = useMode();
  const { groups, loading } = useGroupCtx();
  useEffect(() => setMode("group"), [setMode]);
  if (loading) return null;
  if (groups.length === 0) return <GroupJoinPage />;
  return <>{children}</>;
}
