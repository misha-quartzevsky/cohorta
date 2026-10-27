import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { MONTHS_GENITIVE, pluralRu } from "../lib/format";
import {
  emptyTrash,
  fetchTrash,
  purgeFromTrash,
  restoreFromTrash,
  TRASH_DAYS,
  trashDaysLeft,
  type TrashItem,
} from "../services/trashService";
import { Button, EmptyState, Icon, Modal, SubjectCover } from "../ui";

function deletedOn(deletedAt: string, female: boolean): string {
  const d = new Date(deletedAt.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  return `${female ? "удалена" : "удалён"} ${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

function daysLabel(n: number): string {
  return `${n} ${pluralRu(n, ["день", "дня", "дней"])}`;
}

function meta(item: TrashItem): string {
  if (item.type === "course") {
    const n = item.lectures;
    return `Предмет · ${n} ${pluralRu(n, ["лекция", "лекции", "лекций"])} · ${deletedOn(item.deleted_at, false)}`;
  }
  return `Лекция${item.course_name ? ` · ${item.course_name}` : ""} · ${deletedOn(item.deleted_at, true)}`;
}

/**
 * Корзина (Screen-trash, Screen-m-trash): лекции и предметы хранятся 30
 * дней, потом исчезают. Восстановление возвращает запись и доступ
 * одногруппников к лекции; «Удалить навсегда» стирает сразу.
 */
export default function TrashPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "one"; item: TrashItem } | { kind: "all" } | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchTrash());
      setError("");
    } catch {
      setError("Не удалось загрузить корзину. Проверь связь и попробуй ещё раз.");
      setItems((cur) => cur ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (item: TrashItem) => {
    setBusyKey(item.type + item.id);
    try {
      await restoreFromTrash(item.type, item.id);
      await load();
    } catch {
      setError("Не удалось восстановить. Попробуй ещё раз.");
    } finally {
      setBusyKey("");
    }
  };

  const doConfirm = async () => {
    const c = confirm;
    if (!c) return;
    setBusyKey("confirm");
    try {
      if (c.kind === "all") await emptyTrash();
      else await purgeFromTrash(c.item.type, c.item.id);
      setConfirm(null);
      await load();
    } catch {
      setError("Не удалось удалить. Попробуй ещё раз.");
    } finally {
      setBusyKey("");
    }
  };

  const n = items?.length ?? 0;
  const count = `${n} ${pluralRu(n, ["элемент", "элемента", "элементов"])}`;

  return (
    <div className="c-trash">
      <nav className="c-trash-crumb" aria-label="Путь">
        <Link to="/profile" className="up">
          Профиль
        </Link>
        <Icon name="chev" size={14} />
        <span>Корзина</span>
      </nav>
      <button type="button" className="c-back c-trash-back" onClick={() => navigate("/profile")}>
        <Icon name="chev" size={16} className="c-back-ic" />
        Профиль
      </button>
      <div className="c-trash-head">
        <div className="tx">
          <h1>Корзина</h1>
          <span className="sub-d">{items ? count : ""}</span>
          <span className="sub-m">{items ? `${count} · хранятся ${TRASH_DAYS} дней` : ""}</span>
        </div>
        {n > 0 ? (
          <Button variant="secondary" className="c-trash-clear" onClick={() => setConfirm({ kind: "all" })}>
            Очистить корзину
          </Button>
        ) : null}
      </div>
      <p className="c-trash-note">
        Удалённое хранится {TRASH_DAYS} дней, потом исчезает навсегда. Восстановленная лекция вернётся в свой предмет.
      </p>
      {error ? (
        <p className="c-auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {items && n === 0 ? (
        <EmptyState title="Корзина пуста" description="Удалённые лекции и предметы появятся здесь на 30 дней." />
      ) : null}

      {n > 0 ? (
        <ul className="c-trash-list">
          {items!.map((it) => {
            const left = trashDaysLeft(it.deleted_at);
            const key = it.type + it.id;
            return (
              <li key={key} className="c-trash-row">
                <SubjectCover seed={it.cover_seed ?? undefined} size={40} />
                <div className="tx">
                  <span className="t">
                    {it.title || "Без названия"}
                    {it.type === "course" && it.lectures > 0 ? <span className="m-only"> · {it.lectures} {pluralRu(it.lectures, ["лекция", "лекции", "лекций"])}</span> : null}
                  </span>
                  <span className="m d-only">{meta(it)}</span>
                  <span className="m m-only">{it.type === "course" ? "Предмет" : it.course_name || "Лекция"}</span>
                </div>
                <span className="left">
                  <span className="d-only">{daysLabel(left)}</span>
                  <span className="m-only">{left} дн.</span>
                </span>
                <div className="acts">
                  <Button variant="secondary" size="sm" loading={busyKey === key} onClick={() => void restore(it)}>
                    Восстановить
                  </Button>
                  <button type="button" className="purge" onClick={() => setConfirm({ kind: "one", item: it })}>
                    Удалить навсегда
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Modal
        open={confirm != null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "all" ? "Очистить корзину?" : "Удалить навсегда?"}
      >
        <div className="c-delete-body">
          <p>
            {confirm?.kind === "all"
              ? "Всё, что лежит в корзине, будет стёрто без возможности восстановления."
              : `«${confirm?.kind === "one" ? confirm.item.title : ""}» будет стёрто без возможности восстановления.`}
          </p>
          <div className="c-delete-actions">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Отмена
            </Button>
            <Button variant="danger" loading={busyKey === "confirm"} onClick={() => void doConfirm()}>
              {confirm?.kind === "all" ? "Очистить" : "Удалить навсегда"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
