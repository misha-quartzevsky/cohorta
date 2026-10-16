import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import TaskRow from "../components/tasks/TaskRow";
import {
  Button,
  Card,
  SegmentedControl,
  EmptyState,
  SubjectCover,
  useToast,
  type Segment,
} from "../components/ui";
import { useTasks } from "../hooks/useTasks";
import { fetchCourses } from "../services/courseService";
import type { Course, Task } from "../lib/types";
import { courseName } from "../lib/types";
import { lastSemesterSlug } from "../lib/lastSemester";
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

export default function TasksPage() {
  const semSlug = lastSemesterSlug();
  const toast = useToast();
  const { tasks, loading, error, createTask, updateTask, setDone, deleteTask } =
    useTasks();

  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => {
    void fetchCourses().then(setCourses).catch(() => setCourses([]));
  }, []);

  const [tab, setTab] = useState<Tab>("today");
  const [draft, setDraft] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  // undefined = следовать автоопределению из текста; string|null = ручной выбор.
  const [manualSubjectId, setManualSubjectId] = useState<string | null | undefined>(
    undefined
  );
  const quickSubjectRef = useRef<HTMLSelectElement>(null);

  const today = todayStr();
  const subjectRefs: SubjectRef[] = useMemo(
    () => courses.map((c) => ({ id: c.id, name: courseName(c) })),
    [courses]
  );

  const parsed = useMemo(
    () => (draft.trim() ? parseQuickTask(draft, fromDateStr(today), subjectRefs) : null),
    [draft, today, subjectRefs]
  );

  // Ручной выбор предмета живёт, пока пользователь печатает; очищаем его,
  // когда поле снова пустое (начинаем новую задачу).
  useEffect(() => {
    if (!draft.trim()) setManualSubjectId(undefined);
  }, [draft]);

  const effectiveSubjectId =
    manualSubjectId !== undefined ? manualSubjectId : (parsed?.subjectId ?? null);

  const open = tasks.filter(isOpen);
  const overdueCount = open.filter((t) => isOverdue(t, today)).length;
  const todayCount = open.filter((t) => t.due === today).length;
  const soonCount = open.filter(
    (t) => t.due && t.due > today && t.due <= toDateStr(addDays(fromDateStr(today), 14))
  ).length;

  const tabs: Segment<Tab>[] = [
    { value: "today", label: "Сегодня", count: todayCount + overdueCount },
    { value: "soon", label: "Скоро", count: soonCount },
    { value: "all", label: "Все" },
    { value: "done", label: "Выполненные" },
  ];

  async function handleQuickAdd() {
    const text = draft.trim();
    if (!text) return;
    const p = parseQuickTask(text, fromDateStr(today), subjectRefs);
    const subjectId = manualSubjectId !== undefined ? manualSubjectId : p.subjectId;
    setDraft("");
    setManualSubjectId(undefined);
    const created = await createTask({
      title: p.title || text,
      due: p.due,
      subject: subjectId,
    });
    if (created) toast.show("Задача добавлена");
  }

  if (loading && tasks.length === 0) return <LoadingState />;

  const filtered = subjectFilter
    ? tasks.filter((t) => t.subject === subjectFilter)
    : tasks;

  return (
    <>
      <Header
        crumbs={[{ label: "Рабочий стол", to: `/s/${semSlug}` }, { label: "Задачи" }]}
      />
      <div className="ds-page ds-root">
        <div className="ds-page__inner">
          <ErrorBanner message={error} />

          <div className="ds-page__head">
            <div className="ds-page__title-group">
              <h1 className="ds-h1">Задачи</h1>
              <p className="ds-page__subtitle ds-body">
                {open.length} {pluralRu(open.length, ["открытая", "открытые", "открытых"])}
                {overdueCount > 0 &&
                  `, ${overdueCount} ${pluralRu(overdueCount, [
                    "просрочена",
                    "просрочено",
                    "просрочено",
                  ])}`}
              </p>
            </div>
          </div>

          <div className="ds-page__cols">
            <div>
              <div style={{ marginBottom: "var(--space-4)" }}>
                <div className="ds-quickadd">
                  <input
                    className="ds-input"
                    placeholder="Добавить задачу… «реферат по философии до 25 октября»"
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
                  <div className="ds-quickadd__hint">
                    {parsed?.dueLabel && (
                      <span className="ds-badge ds-badge--accent">
                        Срок: {parsed.dueLabel}
                      </span>
                    )}
                    {courses.length > 0 && (
                      <>
                        <button
                          type="button"
                          className={`ds-badge ds-badge--neutral`}
                          style={{ cursor: "pointer", border: "none" }}
                          onClick={() => openSelect(quickSubjectRef.current)}
                        >
                          {effectiveSubjectId
                            ? courseName(
                                courses.find((c) => c.id === effectiveSubjectId) as Course
                              )
                            : "+ Предмет"}
                        </button>
                        <select
                          ref={quickSubjectRef}
                          value={effectiveSubjectId ?? ""}
                          onChange={(e) => setManualSubjectId(e.target.value || null)}
                          aria-label="Предмет новой задачи"
                          style={{ opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
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
              </div>

              <div style={{ marginBottom: "var(--space-5)" }}>
                <SegmentedControl segments={tabs} value={tab} onChange={setTab} />
              </div>

              <TaskList
                tab={tab}
                tasks={filtered}
                today={today}
                courses={courses}
                onToggle={setDone}
                onRename={(id, title) => void updateTask(id, { title })}
                onDue={(id, due) => void updateTask(id, { due })}
                onSubject={(id, subject) => void updateTask(id, { subject })}
                onDelete={(id) => void deleteTask(id)}
                onFocusInput={() => {
                  const el = document.querySelector<HTMLInputElement>(".ds-quickadd .ds-input");
                  el?.focus();
                }}
                onExample={(text) => {
                  setDraft(text);
                  const el = document.querySelector<HTMLInputElement>(".ds-quickadd .ds-input");
                  el?.focus();
                }}
              />
            </div>

            <aside className="ds-panel">
              <Card>
                <h3 className="ds-h3" style={{ marginBottom: "var(--space-3)" }}>
                  По предметам
                </h3>
                {courses.length === 0 ? (
                  <p className="ds-body ds-muted">Пока нет предметов.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {courses.map((c) => {
                      const count = open.filter((t) => t.subject === c.id).length;
                      const active = subjectFilter === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className="ds-menu__item"
                          style={{
                            background: active ? "var(--color-subtle)" : undefined,
                          }}
                          onClick={() => setSubjectFilter(active ? null : c.id)}
                        >
                          <SubjectCover subjectId={c.id} paletteKey={c.color} size={16} />
                          <span style={{ flex: 1, textAlign: "left" }}>{courseName(c)}</span>
                          <span className="ds-numeric ds-subtle-text">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

interface ListProps {
  tab: Tab;
  tasks: Task[];
  today: string;
  courses: Course[];
  onToggle: (id: string, done: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDue: (id: string, due: string | null) => void;
  onSubject: (id: string, subject: string | null) => void;
  onDelete: (id: string) => void;
  onFocusInput: () => void;
  onExample: (text: string) => void;
}

function TaskList({
  tab,
  tasks,
  today,
  courses,
  onToggle,
  onRename,
  onDue,
  onSubject,
  onDelete,
  onFocusInput,
  onExample,
}: ListProps) {
  const open = tasks.filter(isOpen);
  const in14 = toDateStr(addDays(fromDateStr(today), 14));

  const row = (t: Task) => (
    <TaskRow
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

  if (tab === "done") {
    const done = tasks
      .filter((t) => !isOpen(t))
      .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
    if (done.length === 0)
      return <p className="ds-body ds-muted">Пока ничего не выполнено.</p>;
    return <Group title="Выполненные">{done.map(row)}</Group>;
  }

  const overdue = open
    .filter((t) => isOverdue(t, today))
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const todayTasks = open.filter((t) => t.due === today);
  const future = open
    .filter((t) => t.due && t.due > today)
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const noDue = open.filter((t) => !t.due);

  if (tab === "today") {
    if (overdue.length + todayTasks.length === 0)
      return <p className="ds-body ds-muted">На сегодня задач нет.</p>;
    return (
      <>
        {overdue.length > 0 && (
          <Group title="Просрочено" danger>
            {overdue.map(row)}
          </Group>
        )}
        {todayTasks.length > 0 && <Group title="Сегодня">{todayTasks.map(row)}</Group>}
      </>
    );
  }

  if (tab === "soon") {
    const soon = future.filter((t) => (t.due ?? "") <= in14);
    if (soon.length === 0)
      return <p className="ds-body ds-muted">На ближайшие две недели задач нет.</p>;
    return <Group title="Завтра и позже">{soon.map(row)}</Group>;
  }

  // tab === "all"
  if (open.length === 0) {
    return (
      <EmptyState
        title="Задач пока нет"
        text="Добавь первую — или начни с примера."
        actions={
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "center" }}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="ds-badge ds-badge--neutral"
                  style={{ cursor: "pointer" }}
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
      {overdue.length > 0 && (
        <Group title="Просрочено" danger>
          {overdue.map(row)}
        </Group>
      )}
      {todayTasks.length > 0 && <Group title="Сегодня">{todayTasks.map(row)}</Group>}
      {future.length > 0 && <Group title="Завтра и позже">{future.map(row)}</Group>}
      {noDue.length > 0 && <Group title="Без срока">{noDue.map(row)}</Group>}
    </>
  );
}

function Group({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="ds-task-group">
      <div className={`ds-task-group__title${danger ? " ds-task-group__title--danger" : ""}`}>
        {title}
      </div>
      <div className="ds-task-list">{children}</div>
    </div>
  );
}
