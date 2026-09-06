import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import ConfirmDialog from "../../../components/ConfirmDialog";
import useConfirmDialog from "../../../hooks/useConfirmDialog";
import type { PeriodType, Semester } from "../../../lib/types";
import { semesterOrder } from "../../../lib/types";
import {
  createPeriod,
  deleteAllMyPeriods,
  deletePeriod,
  fetchMyPeriods,
  updatePeriod,
} from "../../../services/semesterService";
import { periodLabel, periodWordPlural } from "../labels";

const MIN_COUNT = 1;
const MAX_COUNT = 20;

interface Props {
  periodType: PeriodType;
  customWord: string;
  periods: Semester[];
  setPeriods: (next: Semester[]) => void;
  onBusyChange: (busy: boolean) => void;
}

/** Экран 6 — количество периодов и автогенерация записей в `semesters`. */
export default function StepPeriods({
  periodType,
  customWord,
  periods,
  setPeriods,
  onBusyChange,
}: Props) {
  const [count, setCount] = useState(String(periods.length || ""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const confirm = useConfirmDialog();

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  // Подхватываем незавершённую прошлую попытку — не дублируем.
  useEffect(() => {
    let alive = true;
    fetchMyPeriods()
      .then((rows) => {
        if (!alive || rows.length === 0) return;
        setPeriods(rows);
        setCount(String(rows.length));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = [...periods].sort((a, b) => semesterOrder(a) - semesterOrder(b));

  const labelOf = (p: Semester) =>
    labels[p.id] ?? String(p.label ?? "");

  const runGenerate = async () => {
    const n = parseInt(count, 10);
    if (Number.isNaN(n) || n < MIN_COUNT || n > MAX_COUNT) {
      setError(`Введите число от ${MIN_COUNT} до ${MAX_COUNT}.`);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await deleteAllMyPeriods();
      const created: Semester[] = [];
      for (let i = 1; i <= n; i += 1) {
        created.push(
          await createPeriod({
            label: periodLabel(i, periodType, customWord),
            order: i,
            type: periodType,
          })
        );
      }
      setPeriods(created);
      setLabels({});
    } catch {
      setError("Не удалось создать периоды. Проверьте соединение и попробуйте ещё раз.");
      // Синхронизируемся с реальным состоянием в БД.
      try {
        setPeriods(await fetchMyPeriods());
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () => {
    if (periods.length > 0) {
      confirm.ask(
        "Пересоздать периоды?",
        `Текущий список из ${periods.length} шт. будет удалён и заменён новым.`,
        () => {
          void runGenerate();
        }
      );
      return;
    }
    void runGenerate();
  };

  const commitLabel = async (p: Semester) => {
    const next = labelOf(p).trim();
    if (!next || next === p.label) return;
    setBusy(true);
    try {
      const updated = await updatePeriod(p.id, { label: next });
      setPeriods(periods.map((x) => (x.id === p.id ? updated : x)));
    } catch {
      setError("Не удалось переименовать период.");
    } finally {
      setBusy(false);
    }
  };

  const removeRow = async (p: Semester) => {
    setBusy(true);
    try {
      await deletePeriod(p.id);
      setPeriods(periods.filter((x) => x.id !== p.id));
    } catch {
      setError("Не удалось удалить период.");
    } finally {
      setBusy(false);
    }
  };

  const addRow = async () => {
    const nextOrder =
      (sorted.length ? semesterOrder(sorted[sorted.length - 1]) : 0) + 1;
    setBusy(true);
    try {
      const created = await createPeriod({
        label: periodLabel(nextOrder, periodType, customWord),
        order: nextOrder,
        type: periodType,
      });
      setPeriods([...periods, created]);
      setCount(String(periods.length + 1));
    } catch {
      setError("Не удалось добавить период.");
    } finally {
      setBusy(false);
    }
  };

  const markCurrent = async (p: Semester) => {
    setBusy(true);
    try {
      const next: Semester[] = [];
      for (const x of periods) {
        const shouldBe = x.id === p.id;
        if (Boolean(x.is_current) === shouldBe) {
          next.push(x);
          continue;
        }
        next.push(await updatePeriod(x.id, { is_current: shouldBe }));
      }
      setPeriods(next);
    } catch {
      setError("Не удалось отметить текущий период.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onb-step">
      <label className="onb-label" htmlFor="onb-count">
        Сколько всего {periodWordPlural(periodType, customWord)} за время учёбы?
      </label>
      <div className="onb-row">
        <input
          id="onb-count"
          className="field onb-row-grow"
          type="number"
          min={MIN_COUNT}
          max={MAX_COUNT}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          placeholder="Например, 8"
          disabled={busy}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={busy}
        >
          Создать
        </button>
      </div>

      {error && <p className="onb-error">{error}</p>}

      {sorted.length > 0 && (
        <div className="onb-periods">
          {sorted.map((p) => (
            <div key={p.id} className="onb-period-row">
              <button
                type="button"
                className={
                  "onb-period-current" + (p.is_current ? " onb-period-current--on" : "")
                }
                onClick={() => void markCurrent(p)}
                disabled={busy}
                title="Отметить текущим"
                aria-label="Отметить текущим"
              >
                <Check size={13} />
              </button>
              <input
                className="onb-period-input"
                value={labelOf(p)}
                onChange={(e) =>
                  setLabels((m) => ({ ...m, [p.id]: e.target.value }))
                }
                onBlur={() => void commitLabel(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                disabled={busy}
              />
              <button
                type="button"
                className="onb-period-del"
                onClick={() => void removeRow(p)}
                disabled={busy}
                aria-label="Удалить период"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="onb-linkbtn onb-linkbtn--icon"
            onClick={() => void addRow()}
            disabled={busy}
          >
            <Plus size={15} /> Добавить период
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.confirm}
        onCancel={confirm.cancel}
        confirmLabel="Пересоздать"
      />
    </div>
  );
}
