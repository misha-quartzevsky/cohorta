import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { pluralRu } from "../lib/format";
import { useSemester } from "../lib/semesterContext";
import {
  DEGREE_YEARS,
  PERIODS_PER_YEAR,
  dateRangeLabel,
  parseRuDate,
  periodTitle,
  ruDate,
  sampleDatesFor,
} from "../lib/studyPeriods";
import type { DegreeLevel, PeriodType, Semester } from "../lib/types";
import { semesterOrder } from "../lib/types";
import { createPeriod, deletePeriod, updatePeriod } from "../services/semesterService";
import { setDegreeAndCourse } from "../services/profileService";
import { Button, Icon, Input, Modal, Pills, StatusChip } from "../ui";
import { DEGREE_LABEL } from "../lib/degree";
import SettingsLayout from "../components/settings/SettingsLayout";

interface Row {
  /** id записи; пусто у только что добавленного периода. */
  id: string;
  key: string;
  label: string;
  order: number;
  from: string;
  to: string;
  current: boolean;
}

const DEGREES = Object.keys(DEGREE_LABEL) as DegreeLevel[];

const TYPE_TABS: { value: PeriodType; label: string }[] = [
  { value: "semester", label: "Семестры" },
  { value: "trimester", label: "Триместры" },
  { value: "quarter", label: "Четверти" },
  { value: "custom", label: "Своё название" },
];

const PER_YEAR_FORMS: Record<PeriodType, [string, string, string]> = {
  semester: ["семестр", "семестра", "семестров"],
  trimester: ["триместр", "триместра", "триместров"],
  quarter: ["четверть", "четверти", "четвертей"],
  module: ["модуль", "модуля", "модулей"],
  custom: ["период", "периода", "периодов"],
};

function toRows(list: Semester[]): Row[] {
  return [...list]
    .sort((a, b) => semesterOrder(a) - semesterOrder(b))
    .map((s) => ({
      id: s.id,
      key: s.id,
      label: String(s.label ?? ""),
      order: semesterOrder(s),
      from: ruDate(s.date_from),
      to: ruDate(s.date_to),
      current: Boolean(s.is_current),
    }));
}

/** Проверка дат строки: оба поля пустые или оба верные, начало не позже конца. */
function rowProblem(r: Row): string {
  if (!r.from.trim() && !r.to.trim()) return "";
  const f = parseRuDate(r.from);
  const t = parseRuDate(r.to);
  if (!f || !t) return `${r.label}: даты пишем как 01.09.2025`;
  if (f > t) return `${r.label}: начало позже конца`;
  return "";
}

export default function SettingsPeriodsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { semesters, refetch } = useSemester();
  const phone = useMediaQuery("(max-width: 767px)");

  const [rows, setRows] = useState<Row[]>([]);
  const [type, setType] = useState<PeriodType>("semester");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editKey, setEditKey] = useState("");
  const loaded = useRef(false);

  // Периоды приходят из провайдера; черновик заводим один раз.
  useEffect(() => {
    if (loaded.current && rows.length > 0) return;
    if (semesters.length === 0) return;
    loaded.current = true;
    setRows(toRows(semesters));
    setType((semesters[0].type ?? "semester") as PeriodType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semesters]);

  const degreeSet = Boolean(user?.degree_level);
  const degree = (user?.degree_level || "bachelor") as DegreeLevel;
  const years = DEGREE_YEARS[degree];
  const perYear = PERIODS_PER_YEAR[type];
  const total = rows.length;

  const dirty = useMemo(() => {
    const base = toRows(semesters);
    if (base.length !== rows.length) return true;
    return rows.some((r, i) => {
      const b = base[i];
      return !b || b.id !== r.id || b.label !== r.label || b.from !== r.from || b.to !== r.to || b.current !== r.current;
    }) || semesters.some((s) => (s.type ?? "semester") !== type);
  }, [rows, semesters, type]);

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const makeCurrent = (key: string) => setRows((rs) => rs.map((r) => ({ ...r, current: r.key === key })));

  const changeType = (next: PeriodType) => {
    setType(next);
    setRows((rs) => rs.map((r) => ({ ...r, label: periodTitle(r.order, next) })));
  };

  const addRow = (): Row => {
    const order = Math.max(0, ...rows.map((r) => r.order)) + 1;
    const first = rows[0] ? parseRuDate(rows[0].from) : "";
    const d = sampleDatesFor(order, type, first || undefined);
    const row: Row = {
      id: "",
      key: `new-${order}-${Date.now()}`,
      label: periodTitle(order, type),
      order,
      from: d ? ruDate(d.from) : "",
      to: d ? ruDate(d.to) : "",
      current: false,
    };
    setRows((rs) => [...rs, row]);
    return row;
  };

  const removeLast = () => setRows((rs) => (rs.length > 1 ? rs.slice(0, -1) : rs));
  const removeRow = (key: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));

  const save = async (list: Row[] = rows, nextType: PeriodType = type) => {
    for (const r of list) {
      const p = rowProblem(r);
      if (p) {
        setError(p);
        return false;
      }
    }
    setBusy(true);
    setError("");
    try {
      const keep = new Set(list.map((r) => r.id).filter(Boolean));
      const failed: string[] = [];
      for (const s of semesters) {
        if (!keep.has(s.id)) {
          try {
            await deletePeriod(s.id);
          } catch {
            failed.push(String(s.label ?? ""));
          }
        }
      }
      let currentSeen = false;
      for (const r of list) {
        const current = r.current && !currentSeen;
        if (current) currentSeen = true;
        const body = {
          label: r.label,
          order: r.order,
          type: nextType,
          is_current: current,
          date_from: parseRuDate(r.from),
          date_to: parseRuDate(r.to),
        };
        if (r.id) await updatePeriod(r.id, body);
        else await createPeriod({ ...body });
      }
      await refetch();
      loaded.current = false;
      if (failed.length) {
        setError(`Не удалось удалить: ${failed.join(", ")}. В периоде есть предметы или пары.`);
        return false;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (e) {
      console.error("Сохранение периодов:", e);
      setError("Не удалось сохранить периоды. Попробуй ещё раз.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const changeDegree = async (d: DegreeLevel) => {
    try {
      const course = Math.min(user?.course ?? 1, DEGREE_YEARS[d]);
      await setDegreeAndCourse(d, course);
    } catch {
      setError("Не удалось поменять форму обучения.");
    }
  };

  const shown = expanded ? rows : rows.slice(0, 4);
  const hidden = rows.length - shown.length;
  const hiddenLabel = `и ещё ${hidden} ${pluralRu(hidden, ["период", "периода", "периодов"])}`;
  const editing = rows.find((r) => r.key === editKey) ?? null;

  const typeHint = `${years} ${pluralRu(years, ["год", "года", "лет"])} × ${perYear} ${pluralRu(perYear, PER_YEAR_FORMS[type])}. Так мы подставили по умолчанию.`;

  /* ---------- Телефон (Screen-m-settings-periods) ---------- */
  if (phone) {
    return (
      <div className="c-periods-m">
        <button type="button" className="c-back" onClick={() => navigate("/profile")}>
          <Icon name="chev" size={16} className="c-back-ic" />
          Профиль
        </button>
        <div className="c-periods-m-head">
          <h1>Периоды учёбы</h1>
          <span>
            {degreeSet ? `${DEGREE_LABEL[degree]} · ` : ""}
            {total} {pluralRu(total, ["период", "периода", "периодов"])}
          </span>
        </div>
        <Pills
          aria-label="Тип периодов"
          value={type}
          options={TYPE_TABS.map((t) => ({ value: t.value, label: t.label }))}
          onChange={(v) => {
            changeType(v);
            void save(
              rows.map((r) => ({ ...r, label: periodTitle(r.order, v) })),
              v
            );
          }}
        />
        <div className="c-m-list">
          {shown.map((r) => (
            <button key={r.key} type="button" onClick={() => setEditKey(r.key)}>
              <span className="tx">
                <span className="t">{r.label}</span>
                <span className="m">{dateRangeLabel(parseRuDate(r.from), parseRuDate(r.to), true)}</span>
              </span>
              {r.current ? <StatusChip tone="accent">Сейчас</StatusChip> : null}
              <Icon name="chev" size={18} />
            </button>
          ))}
        </div>
        {hidden > 0 ? (
          <button type="button" className="c-periods-more-m" onClick={() => setExpanded(true)}>
            {hiddenLabel}
          </button>
        ) : null}
        {error ? <p className="c-periods-err">{error}</p> : null}
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            const r = addRow();
            setEditKey(r.key);
          }}
        >
          Добавить период
        </Button>

        <Modal open={Boolean(editing)} onClose={() => setEditKey("")} title="Период" className="c-sheet-dialog" bare>
          {editing ? (
            <div className="c-erow-fields">
              <h2 className="c-pick-title">{editing.label}</h2>
              <Input label="Название" value={editing.label} onChange={(e) => patch(editing.key, { label: e.target.value })} />
              <Input label="Начало" value={editing.from} placeholder="01.09.2025" inputMode="numeric" onChange={(e) => patch(editing.key, { from: e.target.value })} />
              <Input label="Конец" value={editing.to} placeholder="31.01.2026" inputMode="numeric" onChange={(e) => patch(editing.key, { to: e.target.value })} />
              {!editing.current ? (
                <Button variant="secondary" onClick={() => makeCurrent(editing.key)}>
                  Сделать текущим
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="lg"
                loading={busy}
                onClick={async () => {
                  if (await save()) setEditKey("");
                }}
              >
                Сохранить
              </Button>
              <Button
                variant="danger"
                disabled={rows.length <= 1}
                onClick={async () => {
                  const next = rows.filter((r) => r.key !== editing.key);
                  setRows(next);
                  if (await save(next)) setEditKey("");
                }}
              >
                Удалить период
              </Button>
              {error ? <small className="c-erow-err">{error}</small> : null}
            </div>
          ) : null}
        </Modal>
      </div>
    );
  }

  /* ---------- Компьютер (Screen-settings-periods) ---------- */
  return (
    <SettingsLayout active="study" onPick={(id) => navigate(`/settings#${id}`)}>
      <section className="c-settings-card c-periods c-periods-desktop">
        <div className="c-periods-head">
          <h2>Периоды учёбы</h2>
          <p>Лекции, расписание и архив делятся по периодам. Текущий период переключаем здесь.</p>
        </div>
        <div className="c-periods-group">
          <span className="lbl">Форма обучения</span>
          <div className="c-onb-chips">
            {DEGREES.map((d) => (
              <button key={d} type="button" className={`c-onb-chip${degreeSet && degree === d ? " on" : ""}`} aria-pressed={degreeSet && degree === d} onClick={() => void changeDegree(d)}>
                {DEGREE_LABEL[d]}
              </button>
            ))}
          </div>
          <span className="hint">Форму обучения можно поменять, но нельзя удалить.</span>
        </div>
        <div className="c-periods-group">
          <span className="lbl">Тип периодов</span>
          <div className="c-onb-chips">
            {TYPE_TABS.map((t) => (
              <button key={t.value} type="button" className={`c-onb-chip${type === t.value ? " on" : ""}`} aria-pressed={type === t.value} onClick={() => changeType(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="c-periods-group">
          <span className="lbl">Количество периодов</span>
          <div className="c-periods-count">
            <div className="c-stepper">
              <button type="button" aria-label="Меньше" onClick={removeLast} disabled={total <= 1}>
                −
              </button>
              <output aria-live="polite">{total}</output>
              <button type="button" aria-label="Больше" onClick={() => addRow()}>
                +
              </button>
            </div>
            <span className="hint">{typeHint}</span>
          </div>
        </div>
        <div className="c-periods-rows">
          {shown.map((r) => {
            const bad = rowProblem(r) !== "";
            return (
              <div key={r.key} className="c-period-row">
                <span className="nm">
                  <input
                    className="c-period-name"
                    aria-label="Название периода"
                    value={r.label}
                    onChange={(e) => patch(r.key, { label: e.target.value })}
                  />
                  {r.current ? (
                    <StatusChip tone="accent">Сейчас</StatusChip>
                  ) : (
                    <button type="button" className="cur-btn" onClick={() => makeCurrent(r.key)}>
                      Сделать текущим
                    </button>
                  )}
                </span>
                <span className="dates">
                  <input aria-label={`${r.label}: начало`} className={bad ? "bad" : ""} value={r.from} placeholder="01.09.2025" inputMode="numeric" onChange={(e) => patch(r.key, { from: e.target.value })} />
                  –
                  <input aria-label={`${r.label}: конец`} className={bad ? "bad" : ""} value={r.to} placeholder="31.01.2026" inputMode="numeric" onChange={(e) => patch(r.key, { to: e.target.value })} />
                </span>
                <button type="button" className="del" aria-label={`Удалить: ${r.label}`} onClick={() => removeRow(r.key)} disabled={rows.length <= 1}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            );
          })}
        </div>
        {hidden > 0 ? (
          <button type="button" className="c-periods-more" onClick={() => setExpanded(true)}>
            {hiddenLabel}
          </button>
        ) : null}
        {error ? (
          <p className="c-periods-err" role="alert">
            {error}
          </p>
        ) : null}
        <div className="c-periods-foot">
          <Button variant="secondary" onClick={() => addRow()}>
            <Icon name="plus" size={16} /> Добавить период
          </Button>
          <span className="c-periods-saved" role="status">
            {saved ? "Сохранено" : ""}
          </span>
          <Button variant="primary" onClick={() => void save()} loading={busy} disabled={!dirty}>
            Сохранить
          </Button>
        </div>
      </section>
    </SettingsLayout>
  );
}
