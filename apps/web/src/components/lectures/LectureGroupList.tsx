/**
 * Список лекций с группами «Эта неделя» / «Ранее» (B2).
 * Один компонент на «Все лекции» и вкладку «Лекции» предмета:
 * Screen-lectures, Screen-subject-lectures и телефонные Screen-m-lectures-all,
 * Screen-m-subject-lectures. Строка: обложка предмета, название, подпись,
 * статус точкой и словом, «···» (только на компьютере, в телефонных макетах
 * его в строке нет), шеврон. Подпись на телефоне короче (дата «11 окт»).
 * Меню «···»: Screen-lecture-menu (components/lectures/useLectureActions).
 */

import { useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import type { LectureOverviewRow } from "../../hooks/useLecturesOverview";
import { courseName, lectureHref, lectureTitle, type Lecture } from "../../lib/types";
import { groupByWeek } from "../../lib/lectureGroups";
import { Icon, List, StatusChip, SubjectCover } from "../../ui";
import { useLectureActions } from "./useLectureActions";

function formatDate(dateStr: string | undefined, month: "long" | "short"): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("ru-RU", { day: "numeric", month })
    .replace(".", "");
}

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

interface Props {
  rows: LectureOverviewRow[];
  semSlug: string;
  /** На «Все лекции» в подписи есть предмет; на странице предмета — нет. */
  showSubject: boolean;
}

export default function LectureGroupList({ rows, semSlug, showSubject }: Props) {
  const navigate = useNavigate();
  const actions = useLectureActions();
  const visible = rows.filter((r) => !actions.isHidden(r.lecture));
  const groups = groupByWeek(visible, (r) => r.lecture.lecture_date || r.lecture.created);

  return (
    <div className="c-lec-groups">
      {groups.map((group) => (
        <section key={group.key} className="c-lec-group">
          <h2 className="c-lec-group-title">{group.title}</h2>
          <List className="c-lec-list">
            {group.items.map((row) => {
              const { lecture } = row;
              const course = lecture.field ? lecture.expand?.field : undefined;
              const subject = course ? courseName(course) : "Без предмета";
              const number = lecture.number ? `Лекция ${lecture.number}` : "";
              const date = lecture.lecture_date || lecture.created;
              const long = formatDate(date, "long");
              const short = formatDate(date, "short");
              const renaming = actions.renamingId === lecture.id;
              const open = () => navigate(lectureHref(lecture, semSlug));
              return (
                <div
                  key={lecture.id}
                  className={`c-row c-lec-row${renaming ? "" : " link"}`}
                  role={renaming ? undefined : "link"}
                  tabIndex={renaming ? undefined : 0}
                  // Меню и окна живут в порталах, но события всплывают по дереву React: чужие клики не открывают лекцию.
                  onClick={renaming ? undefined : (e) => e.currentTarget.contains(e.target as Node) && open()}
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
                      <RenameField
                        lecture={lecture}
                        onSave={(v) => void actions.commitRename(lecture, v)}
                        onCancel={actions.cancelRename}
                      />
                    ) : (
                      <>
                        <span className="t">{lectureTitle(lecture)}</span>
                        <span className="m">
                          <span className="c-lec-meta-wide">
                            {[showSubject ? subject : "", number, long].filter(Boolean).join(" · ")}
                          </span>
                          <span className="c-lec-meta-narrow">
                            {[showSubject ? subject : number, short].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </>
                    )}
                  </span>
                  {!renaming && (
                    <>
                      <StatusChip tone={row.status.tone}>{row.status.label}</StatusChip>
                      {actions.menu(lecture)}
                      <Icon name="chev" size={18} className="c-lec-chev" />
                    </>
                  )}
                </div>
              );
            })}
          </List>
        </section>
      ))}
      {actions.dialogs}
    </div>
  );
}
