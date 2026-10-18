/**
 * ============================================
 *  TasksPageNew.tsx — «Задачи» (B3, 2026-10-20)
 * ============================================
 *
 * Вёрстка 1:1 по docs/design/screens/Screen-tasks(-m).dc.html. Автозадачи
 * повторения (spec 5.3, hooks/useReviewSuggestions.ts) показываются в
 * группе «Сегодня» отдельными строками с подписью «Предложено», без
 * срока — выполнение создаёт настоящую запись tasks (source=auto_review),
 * «Скрыть» — запись с dismissed=true, дальше не предлагается (dedupe_key).
 *
 * За флагом VITE_NEW_UI — подключена в App.tsx вместо TasksPage.tsx
 * только когда isNewUI().
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import TaskRowNew from "../components/tasks/TaskRowNew";
import { Button, Pills, EmptyState, SubjectCover } from "../ui";
import { useTasks } from "../hooks/useTasks";
import { useReviewSuggestions } from "../hooks/useReviewSuggestions";
import type { ReviewSuggestion } from "../lib/getReviewSuggestions";
import { fetchCourses } from "../services/courseService";
import type { Course, Task } from "../lib/types";
import { courseName } from "../lib/types";
import { todayStr, fromDateStr, addDays, toDateStr } from "../lib/localDate";
import { isOpen, isOverdue } from "../lib/taskView";
import { parseQuickTask, type SubjectRef } from "../lib/parseQuickTask";
import { openSelect } from "../lib/openSelect";
import { pluralRu } from "../lib/format";

type Tab = "today" | "soon" | "all" | "done";

const EXAMPLES = [
  "Реферат по философии до 25 октября",
  "Сдать лабу завтра",
  "Прочитать главу 3 до пятницы",
];

export default function TasksPageNew() {
  const { tasks, loading, error, createTask, updateTask, setDone, deleteTask } = useTasks();

  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => {
    void fetchCourses().then(setCourses).catch(() => setCourses([]));
  }, []);

  const dismissedOrDoneDedupeKeys = useMemo(
    () =>
      new Set(
        tasks
          .filter((t) => t.dedupe_key && (!!t.done_at || t.dismissed))
          .map((t) => t.dedupe_key as string)
      ),
    [tasks]
  );
  const { suggestions } = useReviewSuggestions(dismissedOrDoneDedupeKeys);

  const [tab, setTab] = useState<Tab>("today");
  const [draft, setDraft] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [manualSubjectId, setManualSubjectId] = useState<string | null | undefined>(undefined);
  const quickSubjectRef = useRef<HTMLSelectElement>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);

  const today = todayStr();
  const subjectRefs: SubjectRef[] = useMemo(
    () => courses.map((c) => ({ id: c.id, name: courseName(c) })),
    [courses]
  );

  const parsed = useMemo(
    () => (draft.trim() ? parseQuickTask(draft, fromDateStr(today), subjectRefs) : null),
    [draft, today, subjectRefs]
  );

  useEffect(() => {
    if (!draft.trim()) setManualSubjectId(undefined);
  }, [draft]);

  const effectiveSubjectId =
    manualSubjectId !== undefined ? manualSubjectId : (parsed?.subjectId ?? null);

  const open = tasks.filter(isOpen);
  const overdueCount = open.filter((t) => isOverdue(t, today)).length;
  const todayCount = open.filter((t) => t.due === today).length + suggestions.length;
  const soonCount = open.filter(
    (t) => t.due && t.due > today && t.due <= toDateStr(addDays(fromDateStr(today), 14))
  ).length;
  const allCount = open.length;
  const doneCount = tasks.length - open.length;

  async function handleQuickAdd() {
    const text = draft.trim();
    if (!text) return;
    const p = parseQuickTask(text, fromDateStr(today), subjectRefs);
    const subjectId = manualSubjectId !== undefined ? manualSubjectId : p.subjectId;
    setDraft("");
    setManualSubjectId(undefined);
    await createTask({ title: p.title || text, due: p.due, subject: subjectId });
  }

  async function handleSuggestionDone(s: ReviewSuggestion) {
    await createTask({
      title: s.title,
      lecture: s.lectureId,
      source: "auto_review",
      dedupe_key: s.dedupeKey,
      done_at: today,
    });
  }

  async function handleSuggestionDismiss(s: ReviewSuggestion) {
    await createTask({
      title: s.title,
      lecture: s.lectureId,
      source: "auto_review",
      dedupe_key: s.dedupeKey,
      dismissed: true,
    });
  }

  if (loading && tasks.length === 0) return null;

  const filtered = subjectFilter ? tasks.filter((t) => t.subject === subjectFilter) : tasks;

  return (
    <div className="c-tasks">
      <div className="c-tasks-head">
        <div className="c-tasks-head-tx">
          <h1>Задачи</h1>
          <span>
            {allCount} {pluralRu(allCount, ["открытая", "открытые", "открытых"])}
            {overdueCount > 0 &&
              `, ${overdueCount} ${pluralRu(overdueCount, ["просрочена", "просрочено", "просрочено"])}`}
          </span>
        </div>
      </div>
      <div className="c-tasks-m-head">
        <h1>Задачи</h1>
        <span>
          {allCount} {pluralRu(allCount, ["открытая", "открытые", "открытых"])}
          {overdueCount > 0 && `, ${overdueCount} просрочено`}
        </span>
      </div>

      {error && <p style={{ color: "var(--danger-text)", fontSize: 14 }}>{error}</p>}

      <div className="c-tasks-quickadd">
        <input
          ref={draftInputRef}
          placeholder="Добавить задачу, например «реферат по философии до 25 октября»"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleQuickAdd();
          }}
        />
        <Button onClick={() => void handleQuickAdd()} disabled={!draft.trim()}>
          Добавить
        </Button>
      </div>
      {draft.trim() && (
        <div className="c-tasks-quickadd-hint">
          {parsed?.dueLabel && (
            <span className="c-tasks-quickadd-subject" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
              Срок: {parsed.dueLabel}
            </span>
          )}
          {courses.length > 0 && (
            <>
              <button type="button" className="c-tasks-quickadd-subject" onClick={() => openSelect(quickSubjectRef.current)}>
                {effectiveSubjectId
                  ? courseName(courses.find((c) => c.id === effectiveSubjectId) as Course)
                  : "+ Предмет"}
              </button>
              <select
                ref={quickSubjectRef}
                value={effectiveSubjectId ?? ""}
                onChange={(e) => setManualSubjectId(e.target.value || null)}
                aria-label="Предмет новой задачи"
                className="c-task-row-hidden-input"
                tabIndex={-1}
              >
                <option value="">Без предмета</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {courseName(c)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      <Pills
        aria-label="Вкладки задач"
        value={tab}
        onChange={setTab}
        options={[
          { value: "today", label: "Сегодня", count: todayCount },
          { value: "soon", label: "Скоро", count: soonCount },
          { value: "all", label: "Все", count: allCount },
          { value: "done", label: "Выполненные", count: doneCount },
        ]}
      />

      <div className="c-tasks-cols">
        <div className="c-tasks-main">
          <TaskList
            tab={tab}
            tasks={filtered}
            suggestions={tab === "today" || tab === "all" ? suggestions : []}
            today={today}
            courses={courses}
            onToggle={setDone}
            onRename={(id, title) => void updateTask(id, { title })}
            onDue={(id, due) => void updateTask(id, { due })}
            onSubject={(id, subject) => void updateTask(id, { subject })}
            onDelete={(id) => void deleteTask(id)}
            onSuggestionDone={(s) => void handleSuggestionDone(s)}
            onSuggestionDismiss={(s) => void handleSuggestionDismiss(s)}
            onFocusInput={() => draftInputRef.current?.focus()}
            onExample={(text) => {
              setDraft(text);
              draftInputRef.current?.focus();
            }}
          />
        </div>

        <aside className="c-tasks-aside">
          <div className="c-schedule-card">
            <span className="c-schedule-card-label">По предметам</span>
            {courses.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)" }}>Пока нет предметов.</p>
            ) : (
              <div className="c-tasks-subjects">
                {courses.map((c) => {
                  const count = open.filter((t) => t.subject === c.id).length;
                  const active = subjectFilter === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`c-tasks-subject-row${active ? " on" : ""}`}
                      onClick={() => setSubjectFilter(active ? null : c.id)}
                    >
                      <span className="c-tasks-subject-row-name">
                        <SubjectCover seed={c.cover_seed} size={20} />
                        {courseName(c)}
                      </span>
                      <span className="c-tasks-subject-row-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

interface ListProps {
  tab: Tab;
  tasks: Task[];
  suggestions: ReviewSuggestion[];
  today: string;
  courses: Course[];
  onToggle: (id: string, done: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDue: (id: string, due: string | null) => void;
  onSubject: (id: string, subject: string | null) => void;
  onDelete: (id: string) => void;
  onSuggestionDone: (s: ReviewSuggestion) => void;
  onSuggestionDismiss: (s: ReviewSuggestion) => void;
  onFocusInput: () => void;
  onExample: (text: string) => void;
}

function TaskList({
  tab,
  tasks,
  suggestions,
  today,
  courses,
  onToggle,
  onRename,
  onDue,
  onSubject,
  onDelete,
  onSuggestionDone,
  onSuggestionDismiss,
  onFocusInput,
  onExample,
}: ListProps) {
  const open = tasks.filter(isOpen);
  const in14 = toDateStr(addDays(fromDateStr(today), 14));

  const row = (t: Task) => (
    <TaskRowNew
      key={t.id}
      task={t}
      courses={courses}
      onToggle={(done) => onToggle(t.id, done)}
      onRename={(title) => onRename(t.id, title)}
      onDue={(due) => onDue(t.id, due)}
      onSubject={(subject) => onSubject(t.id, subject)}
      onDelete={() => onDelete(t.id)}
    />
  );

  const suggestionRow = (s: ReviewSuggestion) => (
    <SuggestionRow
      key={s.dedupeKey}
      suggestion={s}
      onDone={() => onSuggestionDone(s)}
      onDismiss={() => onSuggestionDismiss(s)}
    />
  );

  if (tab === "done") {
    const done = tasks
      .filter((t) => !isOpen(t))
      .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
    if (done.length === 0)
      return <p style={{ fontSize: 14, color: "var(--ink-3)" }}>Пока ничего не выполнено.</p>;
    return <Group title="Выполненные">{done.map(row)}</Group>;
  }

  const overdue = open.filter((t) => isOverdue(t, today)).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const todayTasks = open.filter((t) => t.due === today);
  const future = open.filter((t) => t.due && t.due > today).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const noDue = open.filter((t) => !t.due);

  if (tab === "today") {
    if (overdue.length + todayTasks.length + suggestions.length === 0)
      return <p style={{ fontSize: 14, color: "var(--ink-3)" }}>На сегодня задач нет.</p>;
    return (
      <>
        {overdue.length > 0 && <Group title="Просрочено" danger>{overdue.map(row)}</Group>}
        {(todayTasks.length > 0 || suggestions.length > 0) && (
          <Group title="Сегодня">
            {todayTasks.map(row)}
            {suggestions.map(suggestionRow)}
          </Group>
        )}
      </>
    );
  }

  if (tab === "soon") {
    const soon = future.filter((t) => (t.due ?? "") <= in14);
    if (soon.length === 0)
      return <p style={{ fontSize: 14, color: "var(--ink-3)" }}>На ближайшие две недели задач нет.</p>;
    return <Group title="Завтра и позже">{soon.map(row)}</Group>;
  }

  // tab === "all"
  if (open.length === 0 && suggestions.length === 0) {
    return (
      <EmptyState
        icon="task"
        title="Задач пока нет"
        description="Добавь первую — или начни с примера."
        action={
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="c-tasks-quickadd-subject"
                  onClick={() => onExample(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
            <Button onClick={onFocusInput}>Создать задачу</Button>
          </div>
        }
      />
    );
  }

  return (
    <>
      {overdue.length > 0 && <Group title="Просрочено" danger>{overdue.map(row)}</Group>}
      {(todayTasks.length > 0 || suggestions.length > 0) && (
        <Group title="Сегодня">
          {todayTasks.map(row)}
          {suggestions.map(suggestionRow)}
        </Group>
      )}
      {future.length > 0 && <Group title="Завтра и позже">{future.map(row)}</Group>}
      {noDue.length > 0 && <Group title="Без срока">{noDue.map(row)}</Group>}
    </>
  );
}

function SuggestionRow({
  suggestion,
  onDone,
  onDismiss,
}: {
  suggestion: ReviewSuggestion;
  onDone: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="c-task-suggested-row">
      <button type="button" className="c-task-suggested-main" onClick={onDone}>
        <span className="c-task-suggested-label">Предложено</span>
        <span className="c-task-suggested-title">{suggestion.title}</span>
      </button>
      <button type="button" className="c-task-row-menu-btn" aria-label="Скрыть подсказку" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

function Group({ title, danger, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <div className="c-task-group">
      <div className={`c-task-group-title${danger ? " danger" : ""}`}>{title}</div>
      <div className="c-task-list">{children}</div>
    </div>
  );
}
