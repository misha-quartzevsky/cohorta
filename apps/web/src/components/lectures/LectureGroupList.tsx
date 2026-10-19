/**
 * Список лекций с группами «Эта неделя» / «Ранее» (B2).
 * Один компонент на «Все лекции» и вкладку «Лекции» предмета:
 * Screen-lectures, Screen-subject-lectures и телефонные Screen-m-lectures-all,
 * Screen-m-subject-lectures. Строка: обложка предмета, название, подпись,
 * статус точкой и словом, шеврон. Подпись на телефоне короче (дата «11 окт»).
 */

import { useNavigate } from "react-router-dom";

import type { LectureOverviewRow } from "../../hooks/useLecturesOverview";
import { courseName, lectureHref, lectureTitle } from "../../lib/types";
import { groupByWeek } from "../../lib/lectureGroups";
import { Icon, List, ListRow, StatusChip, SubjectCover } from "../../ui";

function formatDate(dateStr: string | undefined, month: "long" | "short"): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("ru-RU", { day: "numeric", month })
    .replace(".", "");
}

interface Props {
  rows: LectureOverviewRow[];
  semSlug: string;
  /** На «Все лекции» в подписи есть предмет; на странице предмета — нет. */
  showSubject: boolean;
}

export default function LectureGroupList({ rows, semSlug, showSubject }: Props) {
  const navigate = useNavigate();
  const groups = groupByWeek(rows, (r) => r.lecture.lecture_date);

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
              const long = formatDate(lecture.lecture_date, "long");
              const short = formatDate(lecture.lecture_date, "short");
              return (
                <ListRow
                  key={lecture.id}
                  onClick={() => navigate(lectureHref(lecture, semSlug))}
                  cover={<SubjectCover seed={course?.cover_seed} size={40} />}
                  title={lectureTitle(lecture)}
                  meta={
                    <>
                      <span className="c-lec-meta-wide">
                        {[showSubject ? subject : "", number, long].filter(Boolean).join(" · ")}
                      </span>
                      <span className="c-lec-meta-narrow">
                        {[showSubject ? subject : number, short].filter(Boolean).join(" · ")}
                      </span>
                    </>
                  }
                  right={
                    <>
                      <StatusChip tone={row.status.tone}>{row.status.label}</StatusChip>
                      <Icon name="chev" size={18} className="c-lec-chev" />
                    </>
                  }
                />
              );
            })}
          </List>
        </section>
      ))}
    </div>
  );
}
