import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card, Checkbox, SubjectCover, Button } from "../../components/ui";
import { useTasks } from "../../hooks/useTasks";
import { useSchedule } from "../../hooks/useSchedule";
import { useSemester } from "../../lib/semesterContext";
import { fetchScheduledLectures, fetchLecturesOfSubject, startNoteForSlot } from "../../services/scheduleService";
import { fetchCourses } from "../../services/courseService";
import type { Course, Lecture, ScheduleSlot } from "../../lib/types";
import { courseName, courseSlug, semesterSlug } from "../../lib/types";
import { pickActiveSemester } from "../../lib/activeSemester";
import { todayStr, fromDateStr, mondayOf, weekdayMon1 } from "../../lib/localDate";
import { getWeekParity, slotMatchesParity, findLectureForOccurrence } from "../../lib/weekParity";
import { isOpen } from "../../lib/taskView";

/**
 * Блок «Сегодня» на главной (spec 7.1): пары сегодня + задачи на сегодня.
 * Релиз A — без квиза и автоподсказок.
 */
export default function TodayWidget() {
  const navigate = useNavigate();
  const { semesters } = useSemester();
  const activeSemester = useMemo(() => pickActiveSemester(semesters), [semesters]);
  const semId = activeSemester?.id;
  const semSlug = activeSemester ? semesterSlug(activeSemester) : "";

  const { settings, slots } = useSchedule(semId);
  const { tasks, setDone } = useTasks();

  const [courses, setCourses] = useState<Course[]>([]);
  const [scheduled, setScheduled] = useState<Lecture[]>([]);
  useEffect(() => {
    void fetchCourses().then(setCourses).catch(() => {});
    void fetchScheduledLectures().then(setScheduled).catch(() => {});
  }, []);

  const today = todayStr();
  const now = new Date();
  const anchor = settings?.odd_week_anchor ? fromDateStr(settings.odd_week_anchor) : mondayOf(now);
  const parity = getWeekParity(now, anchor);
  const todayWd = weekdayMon1(now);

  const todaySlots = slots
    .filter((s) => s.weekday === todayWd && slotMatchesParity(s.week_parity, parity))
    .sort((a, b) => a.pair_number - b.pair_number);

  const todayTasks = tasks.filter((t) => isOpen(t) && t.due === today);

  function courseFor(slot: ScheduleSlot) {
    return courses.find((c) => c.id === slot.subject);
  }

  async function startNote(slot: ScheduleSlot) {
    const lecturesOfSubject = await fetchLecturesOfSubject(slot.subject);
    const lec = await startNoteForSlot(slot, today, lecturesOfSubject);
    const c = courseFor(slot);
    navigate(c ? `/s/${semSlug}/${courseSlug(c)}/${lec.slug ?? lec.id}/edit` : `/note/${lec.slug ?? lec.id}/edit`);
  }

  function openLecture(lec: Lecture, slot: ScheduleSlot) {
    const c = courseFor(slot);
    navigate(c ? `/s/${semSlug}/${courseSlug(c)}/${lec.slug ?? lec.id}` : `/note/${lec.slug ?? lec.id}`);
  }

  if (todaySlots.length === 0 && todayTasks.length === 0) return null;

  return (
    <div className="ds-root" style={{ display: "grid", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
      {todaySlots.length > 0 && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <h3 className="ds-h3">Пары сегодня</h3>
            <button type="button" className="ds-btn ds-btn--ghost" onClick={() => navigate("/schedule")}>
              Расписание <ChevronRight size={16} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {todaySlots.map((slot) => {
              const lec = findLectureForOccurrence(slot, today, scheduled);
              const c = courseFor(slot);
              return (
                <div key={slot.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <SubjectCover subjectId={slot.subject} paletteKey={c?.color} size={22} />
                  <span style={{ flex: 1, minWidth: 0 }}>{c ? courseName(c) : "Предмет"}</span>
                  {lec ? (
                    <Button variant="secondary" onClick={() => openLecture(lec, slot)}>
                      Открыть конспект
                    </Button>
                  ) : (
                    <Button variant="soft" onClick={() => void startNote(slot)}>
                      Начать конспект
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {todayTasks.length > 0 && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <h3 className="ds-h3">На сегодня</h3>
            <button type="button" className="ds-btn ds-btn--ghost" onClick={() => navigate("/tasks")}>
              Все задачи <ChevronRight size={16} />
            </button>
          </div>
          <div className="ds-task-list">
            {todayTasks.map((t) => (
              <div key={t.id} className="ds-task">
                <Checkbox checked={!isOpen(t)} onChange={(d) => void setDone(t.id, d)} label={t.title} />
                <span className="ds-task__main">{t.title}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
