import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { nameInitials, pluralRu, userName } from "../lib/format";
import { lastSemesterSlug } from "../lib/lastSemester";
import { useMode, type Mode } from "../lib/modeContext";
import { useSemester } from "../lib/semesterContext";
import { DEGREE_YEARS } from "../lib/studyPeriods";
import type { DegreeLevel } from "../lib/types";
import { TRASH_DAYS } from "../services/trashService";
import { avatarUrl } from "../services/profileService";
import { Icon, Modal, Segmented } from "../ui";
import { GroupList } from "../components/group/GroupSidebarBlock";
import { useGroupCtx } from "../lib/groupCtx";
import { useState } from "react";
import type { IconName } from "../ui";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "solo", label: "Соло" },
  { value: "group", label: "Группа" },
];

interface Row {
  icon: IconName;
  title: string;
  sub?: string;
  danger?: boolean;
  onClick: () => void;
}

/**
 * «Профиль» на телефоне (Screen-m-profile и Screen-m-profile-group): аватар,
 * имя, переключатель Соло/Группа и строки. Строка «Уведомления» не
 * показывается: экрана настроек уведомлений нет (решение 19.10). Строки
 * группы «Мой доступ» и «Настройки группы» появятся вместе с экранами
 * волны C. На компьютере профиль — это «Профиль и настройки».
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, setMode, isGroup } = useMode();
  const { current } = useSemester();
  const wide = useMediaQuery("(min-width: 1024px)");
  const { current: cur } = useGroupCtx();
  const [switching, setSwitching] = useState(false);
  const group = cur?.group;
  const roster = { length: cur?.members ?? 0 };

  if (wide) return <Navigate to="/settings" replace />;
  if (!user) return null;

  const name = userName(user);
  const photo = avatarUrl(user);
  const years = user.degree_level ? DEGREE_YEARS[user.degree_level as DegreeLevel] : 0;
  const periods = [current?.label, years ? `${years} ${pluralRu(years, ["год", "года", "лет"])}` : ""].filter(Boolean).join(" · ");

  const exit: Row = {
    icon: "logout",
    title: "Выйти",
    danger: true,
    onClick: () => {
      logout();
      navigate("/login", { replace: true });
    },
  };

  const lists: Row[][] = isGroup
    ? [
        [
          ...(group
            ? [
                {
                  icon: "people" as IconName,
                  title: `Группа ${group.name}`,
                  sub: `${roster.length} ${pluralRu(roster.length, ["студент", "студента", "студентов"])} · переключить`,
                  onClick: () => setSwitching(true),
                },
                {
                  icon: "lock" as IconName,
                  title: "Мой доступ",
                  sub: "Кто что видит из твоих лекций",
                  onClick: () => navigate(`/s/${lastSemesterSlug() || "1"}/group/access`),
                },
                {
                  icon: "gear" as IconName,
                  title: "Настройки группы",
                  sub: "Ссылка, владелец, выход",
                  onClick: () => navigate(`/s/${lastSemesterSlug() || "1"}/group/settings`),
                },
              ]
            : []),
        ],
        [{ icon: "user", title: "Профиль и данные", onClick: () => navigate("/settings") }, exit],
      ]
    : [
        [
          { icon: "user", title: "Профиль и данные", sub: "Имя, город, вуз, курс", onClick: () => navigate("/settings") },
          { icon: "cal", title: "Периоды учёбы", sub: periods || "Семестры и даты", onClick: () => navigate("/settings/periods") },
          { icon: "trash", title: "Корзина", sub: `Удалённое хранится ${TRASH_DAYS} дней`, onClick: () => navigate("/trash") },
        ],
        [{ icon: "shield", title: "Политика данных", onClick: () => navigate("/privacy") }, exit],
      ];

  return (
    <div className="c-profile">
      <div className="c-profile-head">
        <span className="big-av" aria-hidden="true">
          {photo ? <img src={photo} alt="" /> : nameInitials(name)}
        </span>
        <span className="name">{name}</span>
        <span className="mail">{user.email}</span>
      </div>
      <Segmented aria-label="Режим" options={MODE_OPTIONS} value={mode} onChange={setMode} />
      {lists
        .filter((l) => l.length > 0)
        .map((rows, i) => (
          <div key={i} className="c-profile-list">
            {rows.map((r) => (
              <button key={r.title} type="button" className="c-profile-row" onClick={r.onClick}>
                <span className="ic">
                  <Icon name={r.icon} size={20} />
                </span>
                <span className="tx">
                  <span className={`t${r.danger ? " danger" : ""}`}>{r.title}</span>
                  {r.sub ? <span className="m">{r.sub}</span> : null}
                </span>
                <Icon name="chev" size={18} className="chev" />
              </button>
            ))}
          </div>
        ))}
      <Modal open={switching} onClose={() => setSwitching(false)} title="Твои группы">
        <GroupList semSlug={lastSemesterSlug() || "1"} onPick={() => setSwitching(false)} />
      </Modal>
    </div>
  );
}
