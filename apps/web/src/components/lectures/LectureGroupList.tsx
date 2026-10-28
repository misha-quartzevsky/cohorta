/**
 * Список лекций с группами «Эта неделя» / «Ранее» (B2); при «Все периоды» —
 * группы по периодам. Один компонент на «Все лекции» и вкладку «Лекции» предмета:
 * Screen-lectures, Screen-subject-lectures, Screen-m-lectures-all,
 * Screen-m-subject-lectures. Строка: обложка предмета, название, подпись, статус
 * точкой и словом, «···» (компьютер), шеврон. На телефоне кнопки «···» в строке
 * нет: меню открывается долгим нажатием (лист Screen-m-lecture-menu).
 * Меню: Screen-lecture-menu (components/lectures/useLectureActions).
 */

import { useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import type { LectureOverviewRow } from "../../hooks/useLecturesOverview";
import { useLongPress } from "../../hooks/useLongPress";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { formatLocaleDayMonth } from "../../lib/format";
import { useSemester } from "../../lib/semesterContext";
import { courseName, courseSemesterId, lectureHref, lectureTitle, semesterLabel, type Lecture } from "../../lib/types";
import { groupByPeriod, groupByWeek, type LectureGroup } from "../../lib/lectureGroups";
import { Icon, List, StatusChip, SubjectCover } from "../../ui";
import { useLectureActions } from "./useLectureActions";

function RenameField({ lecture, onSave, onCancel }: { lecture: Lecture; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(lectureTitle(lecture));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSave(value);
    if (e.key === "Escape") onCancel();
  };
  return (
    <span className="c-lec-rename">
      <input
        autoFocus
        value={value}
        aria-label="Название лекции"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => onSave(value)}
        onFocus={(e) => e.target.select()}
      />
      <small>Enter сохраняет, Esc отменяет</small>
    </span>
  );
}

interface RowProps {
  row: LectureOverviewRow;
  semSlug: string;
  showSubject: boolean;
  phone: boolean;
  actions: ReturnType<typeof useLectureActions>;
}

function LectureRow({ row, semSlug, showSubject, phone, actions }: RowProps) {
  const navigate = useNavigate();
  const { lecture } = row;
  const course = lecture.field ? lecture.expand?.field : undefined;
  const subject = course ? courseName(course) : "Без предмета";
  const number = lecture.number ? `Лекция ${lecture.number}` : "";
  const date = lecture.lecture_date || lecture.created;
  const long = formatLocaleDayMonth(date, "long");
  const short = formatLocaleDayMonth(date, "short");
  const renaming = actions.renamingId === lecture.id;
  const open = () => navigate(lectureHref(lecture, semSlug));
  const press = useLongPress(() => actions.openSheet(lecture), phone && !renaming);

  return (
    <div
      className={`c-row c-lec-row${renaming ? "" : " link"}${phone ? " touch" : ""}`}
      role={renaming ? undefined : "link"}
      tabIndex={renaming ? undefined : 0}
      {...(renaming ? {} : press.handlers)}
      // Меню и окна живут в порталах, но события всплывают по дереву React: чужие клики не открывают лекцию.
      onClick={renaming ? undefined : (e) => e.currentTarget.contains(e.target as Node) && !press.consumeClick() && open()}
      onKeyDown={(e) => {
        if (!renaming && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          open();
        }
      }}
    >
      <span className="cv">
        <SubjectCover seed={course?.cover_seed} size={40} />
      </span>
      <span className="tx">
        {renaming ? (
          <RenameField lecture={lecture} onSave={(v) => void actions.commitRename(lecture, v)} onCancel={actions.cancelRename} />
        ) : (
          <>
            <span className="t">{lectureTitle(lecture)}</span>
            <span className="m">
              <span className="c-lec-meta-wide">{[showSubject ? subject : "", number, long].filter(Boolean).join(" · ")}</span>
              <span className="c-lec-meta-narrow">{[showSubject ? subject : number, short].filter(Boolean).join(" · ")}</span>
            </span>
          </>
        )}
      </span>
      {!renaming && (
        <>
          <StatusChip tone={row.status.tone}>{row.status.label}</StatusChip>
          {!phone && actions.menu(lecture)}
          <Icon name="chev" size={18} className="c-lec-chev" />
        </>
      )}
    </div>
  );
}

interface Props {
  rows: LectureOverviewRow[];
  semSlug: string;
  /** На «Все лекции» в подписи есть предмет; на странице предмета — нет. */
  showSubject: boolean;
  /** «Все периоды»: группы по периодам вместо «Эта неделя / Ранее». */
  groupByPeriods?: boolean;
}

export default function LectureGroupList({ rows, semSlug, showSubject, groupByPeriods }: Props) {
  const actions = useLectureActions();
  const phone = useMediaQuery("(max-width: 1023px)");
  const { semesters } = useSemester();
  const visible = rows.filter((r) => !actions.isHidden(r.lecture));

  const groups: LectureGroup<LectureOverviewRow>[] = groupByPeriods
    ? groupByPeriod(visible, (r) => {
        const course = r.lecture.field ? r.lecture.expand?.field : undefined;
        const sem = course ? semesters.find((s) => s.id === courseSemesterId(course)) : undefined;
        return sem ? { id: sem.id, label: semesterLabel(sem), order: sem.order ?? 0 } : null;
      })
    : groupByWeek(visible, (r) => r.lecture.lecture_date || r.lecture.created);

  return (
    <div className="c-lec-groups">
      {groups.map((group) => (
        <section key={group.key} className="c-lec-group">
          <h2 className="c-lec-group-title">{group.title}</h2>
          <List className="c-lec-list">
            {group.items.map((row) => (
              <LectureRow key={row.lecture.id} row={row} semSlug={semSlug} showSubject={showSubject} phone={phone} actions={actions} />
            ))}
          </List>
        </section>
      ))}
      {actions.dialogs}
    </div>
  );
}
