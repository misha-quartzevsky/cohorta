import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Modal, Select } from "../../ui";
import { Crumbs, useSem } from "../../components/group/common";
import { UnderstandingAside, UnderstandingScope } from "../../components/quiz/UnderstandingScope";
import { useGroupData } from "../../hooks/useGroupData";
import { useCourses } from "../../hooks/useCourses";
import { useSemester } from "../../lib/semesterContext";
import { pb } from "../../lib/pocketbase";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { lectureDateLabel } from "../../lib/lectureMeta";
import { courseName, courseSlug as courseSlugOf, type Lecture } from "../../lib/types";
import { copyLecture, ruDate, type ShareRow } from "../../services/groupApi";
import { errorMessage } from "../../lib/format";
import { markLectureSeen } from "../../lib/notifyCtx";

type Target = "same" | "other" | "drafts";

/** Окно «Добавить в мои конспекты» (Screen-shared-add): копия отдельная, оригинал не меняется. */
function AddToMine({ lecture, ownerName, open, onClose, sem }: { lecture: Lecture; ownerName: string; open: boolean; onClose: () => void; sem: string }) {
  const navigate = useNavigate();
  const { current } = useSemester();
  const { courses } = useCourses(current?.id ?? "");
  const [subjectName, setSubjectName] = useState("");
  const match = useMemo(() => courses.find((c) => courseName(c).trim().toLowerCase() === subjectName.trim().toLowerCase()), [courses, subjectName]);
  const [target, setTarget] = useState<Target>("other");
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Предмет с тем же названием, что у предмета автора, выбран по умолчанию.
  useEffect(() => {
    if (match) {
      setTarget("same");
      setPick(match.id);
    } else {
      setTarget("other");
      setPick((p) => p || courses[0]?.id || "");
    }
  }, [match, courses]);

  useEffect(() => {
    if (!lecture.field) return;
    // название предмета автора приходит только через предпросмотр
    pb.collection("lecture_previews")
      .getFirstListItem(pb.filter("lecture = {:l}", { l: lecture.id }), { fields: "course_title" })
      .then((r) => setSubjectName(String(r.course_title ?? "")))
      .catch(() => setSubjectName(""));
  }, [lecture.id, lecture.field]);

  const course = target === "drafts" ? undefined : courses.find((c) => c.id === (target === "same" ? match?.id : pick));

  const add = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await copyLecture(lecture.id, course?.id ?? "");
      navigate(course ? `/s/${sem}/${courseSlugOf(course)}/${r.slug}` : `/note/${r.slug}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Добавить в мои конспекты">
      <div className="c-gr-sheet-body">
        <p>
          «{lecture.title}» от {ownerName} станет твоей копией: её можно править, оригинал не изменится.
        </p>
        <span className="c-gr-over">В какой предмет</span>
        <div className="c-gr-pick" role="radiogroup" aria-label="В какой предмет">
          {match && (
            <label className={`opt${target === "same" ? " on" : ""}`}>
              <input type="radio" name="t" checked={target === "same"} onChange={() => setTarget("same")} />
              <span className="tx">
                <span className="t">{courseName(match)}</span>
                <span className="m">Такой предмет у тебя уже есть</span>
              </span>
            </label>
          )}
          <label className={`opt${target === "other" ? " on" : ""}`}>
            <input type="radio" name="t" checked={target === "other"} onChange={() => setTarget("other")} />
            <span className="tx">
              <span className="t">Другой предмет</span>
              <span className="m">Выбрать из списка</span>
            </span>
          </label>
          {target === "other" && courses.length > 0 && (
            <Select aria-label="Предмет" value={pick} onChange={(e) => setPick(e.target.value)}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {courseName(c)}
                </option>
              ))}
            </Select>
          )}
          <label className={`opt${target === "drafts" ? " on" : ""}`}>
            <input type="radio" name="t" checked={target === "drafts"} onChange={() => setTarget("drafts")} />
            <span className="tx">
              <span className="t">Черновики</span>
              <span className="m">Разберёшь позже</span>
            </span>
          </label>
        </div>
        {error ? <p className="c-gr-error">{error}</p> : null}
        <div className="c-gr-modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" loading={busy} disabled={target === "other" && !pick} onClick={() => void add()}>
            Добавить
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Чужая лекция, открытая тебе (Screen-shared-lecture): чтение без функций правки, выделять и копировать текст можно всегда.
 * «Добавить в мои конспекты» — только если автор разрешил копирование этому человеку.
 */
export default function GroupLecturePage() {
  const sem = useSem();
  const { lectureId = "" } = useParams();
  const data = useGroupData();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [share, setShare] = useState<ShareRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => markLectureSeen(lectureId), [lectureId]);
  useEffect(() => {
    let alive = true;
    setLecture(null);
    setMissing(false);
    pb.collection("lectures")
      .getOne<Lecture>(lectureId)
      .then((l) => alive && setLecture(l))
      .catch(() => alive && setMissing(true));
    pb.collection("lecture_shares")
      .getFirstListItem(pb.filter("lecture = {:l} && grantee = {:u} && suspended != true", { l: lectureId, u: pb.authStore.record?.id ?? "" }))
      .then((r) =>
        alive &&
        setShare({
          id: r.id,
          lecture: String(r.lecture),
          owner: String(r.owner),
          grantee: String(r.grantee),
          group: String(r.group ?? ""),
          subgroup: String(r.subgroup ?? ""),
          allowCopy: r.allow_copy === true,
          suspended: false,
          created: String(r.created),
        })
      )
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [lectureId]);

  const preview = data.previews.find((p) => p.lecture === lectureId);
  const ownerName = data.nameOf(lecture?.owner ?? "");
  const html = useMemo(() => sanitizeHtml(lecture?.content ?? ""), [lecture?.content]);
  const subject = preview?.courseTitle ?? "";
  const numberLabel = lecture?.number ? `Лекция ${lecture.number}` : "";

  if (missing) {
    return (
      <div className="c-gr-page">
        <p className="c-gr-hint">Эта лекция недоступна: автор закрыл доступ или её удалил.</p>
        <Link to={`/s/${sem}/group`}>К одногруппникам</Link>
      </div>
    );
  }

  const dateText = lecture?.lecture_date ? lectureDateLabel(new Date(String(lecture.lecture_date).replace(" ", "T"))) : "";

  return (
    <UnderstandingScope lecture={lecture}>
      <div className="c-gr-page c-gr-read">
        <div className="c-gr-readbar">
          <Crumbs
            items={[
              { label: "Одногруппники", to: `/s/${sem}/group` },
              { label: ownerName, to: `/s/${sem}/group/people/${lecture?.owner ?? ""}` },
              ...(subject ? [{ label: subject, to: `/s/${sem}/group/people/${lecture?.owner ?? ""}/${preview?.course || "none"}` }] : []),
              { label: numberLabel || lecture?.title || "" },
            ]}
          />
          {share?.allowCopy && lecture ? (
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              Добавить в мои конспекты
            </Button>
          ) : null}
        </div>
        <div className="c-gr-readcols">
          <article className="c-lecture">
            <header className="c-lecture-head">
              {lecture && (
                <p className="c-lecture-eyebrow">
                  {[subject, numberLabel].filter(Boolean).join(" · ")}
                </p>
              )}
              <h1 className="c-gr-readtitle">{lecture?.title ?? ""}</h1>
              <p className="c-lecture-meta">
                <span>
                  {[dateText, share ? `доступ открыт ${ruDate(share.created)}` : ""].filter(Boolean).join(" · ")}
                </span>
              </p>
            </header>
            <div className="c-lecture-body">
              <div className="lecture-view-content is-html c-gr-readbody" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </article>
          <UnderstandingAside />
        </div>
        {lecture && <AddToMine lecture={lecture} ownerName={ownerName} open={addOpen} onClose={() => setAddOpen(false)} sem={sem} />}
      </div>
    </UnderstandingScope>
  );
}
