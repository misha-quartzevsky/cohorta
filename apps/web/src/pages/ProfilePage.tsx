import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useMode, type Mode } from "../lib/modeContext";
import { nameInitials, userName } from "../lib/format";
import { Icon, Segmented } from "../ui";
import type { IconName } from "../ui";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "solo", label: "Соло" },
  { value: "group", label: "Группа" },
];

interface Row {
  icon: IconName;
  title: string;
  danger?: boolean;
  onClick: () => void;
}

/**
 * «Профиль» на телефоне (Screen-m-profile-draft, блоки 3–4). Пока только
 * то, что уже работает: переключатель Соло/Группа, «Политика данных»,
 * «Выйти». Строки «Профиль и данные», «Периоды учёбы», «Уведомления»,
 * «Корзина» и группа («Мой доступ», «Настройки группы») — экраны волн B6 и C,
 * без них пункты вели бы в никуда, поэтому их здесь нет.
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, setMode } = useMode();
  if (!user) return null;

  const name = userName(user);
  const rows: Row[] = [
    { icon: "shield", title: "Политика данных", onClick: () => navigate("/privacy") },
    {
      icon: "logout",
      title: "Выйти",
      danger: true,
      onClick: () => {
        logout();
        navigate("/login", { replace: true });
      },
    },
  ];

  return (
    <div className="c-profile">
      <div className="c-profile-head">
        <span className="big-av" aria-hidden="true">
          {nameInitials(name)}
        </span>
        <span className="name">{name}</span>
        <span className="mail">{user.email}</span>
      </div>
      <Segmented aria-label="Режим" options={MODE_OPTIONS} value={mode} onChange={setMode} />
      <div className="c-profile-list">
        {rows.map((r) => (
          <button key={r.title} type="button" className="c-profile-row" onClick={r.onClick}>
            <span className="ic">
              <Icon name={r.icon} size={20} />
            </span>
            <span className={`t${r.danger ? " danger" : ""}`}>{r.title}</span>
            <Icon name="chev" size={18} className="chev" />
          </button>
        ))}
      </div>
    </div>
  );
}
