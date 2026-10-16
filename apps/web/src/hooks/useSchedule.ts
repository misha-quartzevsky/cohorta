import { useCallback, useEffect, useState } from "react";
import type { ScheduleSettings, ScheduleSlot } from "../lib/types";
import { errorMessage } from "../lib/format";
import {
  ensureSettings,
  updateSettings as updateSettingsService,
  fetchSlots,
  createSlot as createSlotService,
  updateSlot as updateSlotService,
  deleteSlot as deleteSlotService,
  type SlotInput,
} from "../services/scheduleService";

export interface UseScheduleResult {
  settings: ScheduleSettings | null;
  slots: ScheduleSlot[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  createSlot: (input: SlotInput) => Promise<void>;
  updateSlot: (id: string, input: Partial<SlotInput>) => Promise<void>;
  deleteSlot: (id: string) => Promise<void>;
  updateSettings: (
    patch: Partial<Pick<ScheduleSettings, "pair_times" | "odd_week_anchor" | "show_saturday">>
  ) => Promise<void>;
}

/**
 * Данные расписания: настройки (создаются по умолчанию при первом заходе)
 * и слоты. Опционально ограничены семестром.
 */
export function useSchedule(semesterId?: string): UseScheduleResult {
  const [settings, setSettings] = useState<ScheduleSettings | null>(null);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await ensureSettings();
      setSettings(s);
      setSlots(await fetchSlots(semesterId));
    } catch (e) {
      setError("Не удалось загрузить расписание: " + errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [semesterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createSlot = useCallback(
    async (input: SlotInput) => {
      await createSlotService(input);
      await load();
    },
    [load]
  );

  const updateSlot = useCallback(
    async (id: string, input: Partial<SlotInput>) => {
      await updateSlotService(id, input);
      await load();
    },
    [load]
  );

  const deleteSlot = useCallback(
    async (id: string) => {
      await deleteSlotService(id);
      await load();
    },
    [load]
  );

  const updateSettings = useCallback(
    async (
      patch: Partial<Pick<ScheduleSettings, "pair_times" | "odd_week_anchor" | "show_saturday">>
    ) => {
      if (!settings) return;
      const updated = await updateSettingsService(settings.id, patch);
      setSettings(updated);
    },
    [settings]
  );

  return {
    settings,
    slots,
    loading,
    error,
    refetch: load,
    createSlot,
    updateSlot,
    deleteSlot,
    updateSettings,
  };
}
