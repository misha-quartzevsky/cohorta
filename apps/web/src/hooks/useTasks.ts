import { useCallback, useEffect, useState } from "react";
import type { Task } from "../lib/types";
import { errorMessage } from "../lib/format";
import { todayStr } from "../lib/localDate";
import {
  fetchTasks,
  createTask as createTaskService,
  updateTask as updateTaskService,
  setTaskDone as setTaskDoneService,
  deleteTask as deleteTaskService,
  type TaskInput,
} from "../services/taskService";

export interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  createTask: (input: TaskInput) => Promise<Task | null>;
  updateTask: (id: string, patch: Partial<TaskInput>) => Promise<void>;
  setDone: (id: string, done: boolean) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

/** Данные задач с оптимистичным переключением чекбоксов (spec раздел 3). */
export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTasks(await fetchTasks());
    } catch (e) {
      setError("Не удалось загрузить задачи: " + errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createTask = useCallback(async (input: TaskInput) => {
    try {
      const created = await createTaskService(input);
      setTasks((prev) => [created, ...prev]);
      return created;
    } catch (e) {
      setError("Не удалось создать задачу: " + errorMessage(e));
      return null;
    }
  }, []);

  const updateTask = useCallback(async (id: string, patch: Partial<TaskInput>) => {
    try {
      const updated = await updateTaskService(id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      setError("Не удалось обновить задачу: " + errorMessage(e));
    }
  }, []);

  const setDone = useCallback(async (id: string, done: boolean) => {
    // Оптимистично: строка остаётся на месте, меняется done_at.
    const optimistic = done ? todayStr() : "";
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done_at: optimistic } : t))
    );
    try {
      const updated = await setTaskDoneService(id, done);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      setError("Не удалось обновить задачу: " + errorMessage(e));
      await load();
    }
  }, [load]);

  const deleteTask = useCallback(async (id: string) => {
    const prev = tasks;
    setTasks((cur) => cur.filter((t) => t.id !== id));
    try {
      await deleteTaskService(id);
    } catch (e) {
      setError("Не удалось удалить задачу: " + errorMessage(e));
      setTasks(prev);
    }
  }, [tasks]);

  return {
    tasks,
    loading,
    error,
    refetch: load,
    createTask,
    updateTask,
    setDone,
    deleteTask,
  };
}
