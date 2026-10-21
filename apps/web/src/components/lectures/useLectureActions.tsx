/**
 * Меню лекции «···» и его окна (Screen-lecture-menu): переименовать на месте,
 * перенести в предмет, дублировать, скачать .md, удалить. «Доступ» есть только
 * у владельца в режиме «Группа» — экрана доступа ещё нет (волна C), пункта нет.
 * Всё, что можно вернуть, даёт «Отменить» в тосте.
 */

import { useForms } from "../../lib/formsContext";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Button, Icon, Menu, Modal, SubjectCover } from "../../ui";
import type { MenuItem } from "../../ui";
import { useToast } from "../ui/Toast";
import { useUndo } from "../../lib/undoContext";
import { useSemester } from "../../lib/semesterContext";
import { pickActiveSemester } from "../../lib/activeSemester";
import { fetchCourses } from "../../services/courseService";
import { deleteLecture } from "../../services/lectureService";
import {
  downloadLectureMarkdown,
  duplicateLecture,
  moveLecture,
  renameLecture,
} from "../../services/lectureActions";
import {
  courseName,
  courseSemesterId,
  lectureCourseId,
  lectureHref,
  lectureTitle,
  semesterSlug,
  type Course,
  type Lecture,
} from "../../lib/types";
import { notifyLecturesChanged } from "../../lib/lecturesChanged";

interface Options {
  /** «Переименовать» вне списка (в открытой лекции — фокус на название); по умолчанию правка в строке. */
  onRename?: (lecture: Lecture) => void;
  /** После удаления (в открытой лекции — уйти на страницу предмета). */
  onDeleted?: (lecture: Lecture) => void;
  /** Дополнительные пункты (в открытой лекции: «Теги», «Квиз по лекции»), идут после «Перенести». */
  extraItems?: (lecture: Lecture) => MenuItem[];
  /** Дополнительные пункты листа на телефоне (Screen-m-lecture-menu: «Теги» и «Квиз» там не нужны). */
  sheetExtraItems?: (lecture: Lecture) => MenuItem[];
  /** После переноса в предмет (в открытой лекции — перейти на её новый адрес). */
  onMoved?: (lecture: Lecture, course: Course) => void;
}

export function useLectureActions(options: Options = {}) {
  const navigate = useNavigate();
  const forms = useForms();
  const toast = useToast();
  const { scheduleDelete, isPending } = useUndo();
  const { semesters, current } = useSemester();
  const active = current ?? pickActiveSemester(semesters);
  const semSlug = active ? semesterSlug(active) : "";

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [moveFor, setMoveFor] = useState<Lecture | null>(null);
  const [deleteFor, setDeleteFor] = useState<Lecture | null>(null);
  /** Лист меню на телефоне (долгое нажатие в списке, «···» в открытой лекции). */
  const [sheetFor, setSheetFor] = useState<Lecture | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [picked, setPicked] = useState("");

  useEffect(() => {
    if (!moveFor) return;
    void fetchCourses()
      .then(setCourses)
      .catch(() => {});
  }, [moveFor]);

  const commitRename = useCallback(
    async (lecture: Lecture, value: string) => {
      setRenamingId(null);
      const title = value.trim();
      if (!title || title === lectureTitle(lecture)) return;
      try {
        await renameLecture(lecture.id, title);
      } catch {
        toast.show("Не удалось переименовать лекцию");
      }
    },
    [toast]
  );

  /** Перенос с «Отменить»: возвращает лекцию в прежний предмет (или в черновики). */
  const move = useCallback(
    async (lecture: Lecture, course: Course) => {
      const before = lectureCourseId(lecture);
      try {
        await moveLecture(lecture.id, course.id);
      } catch {
        toast.show("Не удалось перенести лекцию");
        return;
      }
      options.onMoved?.(lecture, course);
      toast.show(`Перенесено в «${courseName(course)}»`, {
        label: "Отменить",
        onClick: () => void moveLecture(lecture.id, before),
      });
    },
    [toast, options]
  );

  /** Пункты меню (одни и те же на компьютере и в листе на телефоне). «Доступ» — волна C. */
  const itemsFor = (lecture: Lecture, phone = false): MenuItem[] => [
      { label: "Переименовать", icon: <Icon name="edit" size={18} />, onClick: () => (options.onRename ? options.onRename(lecture) : setRenamingId(lecture.id)) },
      {
        label: lectureCourseId(lecture) || phone ? "Перенести в предмет" : "Назначить предмет",
        icon: <Icon name="folder" size={18} />,
        onClick: () => {
          setPicked("");
          setMoveFor(lecture);
        },
      },
      ...((phone ? options.sheetExtraItems : options.extraItems)?.(lecture) ?? []),
      {
        label: "Дублировать",
        icon: <Icon name="copy" size={18} />,
        onClick: () =>
          void duplicateLecture(lecture)
            .then((copy) =>
              toast.show("Копия создана", {
                label: "Открыть",
                onClick: () => navigate(lectureHref({ ...copy, expand: lecture.expand }, semSlug)),
              })
            )
            .catch(() => toast.show("Не удалось создать копию")),
      },
      { label: "Скачать, .md", icon: <Icon name="download" size={18} />, onClick: () => downloadLectureMarkdown(lecture) },
      { label: "Удалить", icon: <Icon name="trash" size={18} />, danger: true, separatorBefore: true, onClick: () => setDeleteFor(lecture) },
  ];

  const menu = (lecture: Lecture): ReactNode => (
    <Menu
      width={280}
      aria-label={`Действия: ${lectureTitle(lecture)}`}
      trigger={(p) => (
        <button
          type="button"
          className="c-lec-more"
          aria-label={`Меню лекции «${lectureTitle(lecture)}»`}
          onClick={(e) => {
            e.stopPropagation();
            p.onClick();
          }}
          ref={p.ref}
          aria-expanded={p["aria-expanded"]}
          aria-haspopup={p["aria-haspopup"]}
        >
          <Icon name="dots" size={18} />
        </button>
      )}
      items={itemsFor(lecture)}
    />
  );

  const semesterCourses = courses.filter((c) => !active || courseSemesterId(c) === active.id);
  const currentCourseId = moveFor ? lectureCourseId(moveFor) : "";
  const currentCourse = courses.find((c) => c.id === currentCourseId);

  const sheetCourse = sheetFor?.field ? sheetFor.expand?.field : undefined;
  const dialogs = (
    <>
      <Modal open={!!sheetFor} onClose={() => setSheetFor(null)} title="Меню лекции" className="c-sheet-dialog c-lec-sheet" bare>
        {sheetFor && (
          <>
            <h2 className="c-pick-title">{lectureTitle(sheetFor)}</h2>
            <p className="c-pick-sub">
              {[sheetFor.number ? `Лекция ${sheetFor.number}` : "", sheetCourse ? courseName(sheetCourse) : "Без предмета"]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="c-lec-sheet-list" role="menu" aria-label="Действия">
              {itemsFor(sheetFor, true).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={item.danger ? "bad" : undefined}
                  onClick={() => {
                    const lec = sheetFor;
                    setSheetFor(null);
                    void lec;
                    item.onClick();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!moveFor} onClose={() => setMoveFor(null)} title="Перенести в предмет" className="c-sheet-dialog c-move" bare>
        {moveFor && (
          <>
            <h2 className="c-move-title">{currentCourseId ? "Перенести в предмет" : "Назначить предмет"}</h2>
            <p className="c-move-sub">
              «{lectureTitle(moveFor)}».{" "}
              {currentCourse ? `Сейчас лекция в предмете «${courseName(currentCourse)}».` : "Сейчас лекция без предмета."}
            </p>
            <div className="c-move-list" role="radiogroup" aria-label="Предмет">
              {semesterCourses.map((c) => {
                const here = c.id === currentCourseId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={picked === c.id}
                    disabled={here}
                    className={picked === c.id ? "on" : ""}
                    onClick={() => setPicked(c.id)}
                  >
                    <span className="radio" aria-hidden="true" />
                    <SubjectCover seed={c.cover_seed} size={22} />
                    <span className="name">{courseName(c)}</span>
                    {here && <span className="here">сейчас здесь</span>}
                  </button>
                );
              })}
              <button
                type="button"
                className="new"
                onClick={() => {
                  setMoveFor(null);
                  if (forms) forms.openSubjectForm();
                  else navigate(`/s/${semSlug}/courses`);
                }}
              >
                <Icon name="plus" size={18} />
                Новый предмет
              </button>
            </div>
            <div className="c-move-foot">
              <Button variant="ghost" onClick={() => setMoveFor(null)}>
                Отмена
              </Button>
              <Button
                variant="primary"
                disabled={!picked}
                onClick={() => {
                  const target = semesterCourses.find((c) => c.id === picked);
                  const lec = moveFor;
                  setMoveFor(null);
                  if (target) void move(lec, target);
                }}
              >
                {currentCourseId ? "Перенести" : "Назначить"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title="Удалить лекцию?" className="c-sheet-dialog c-move" bare>
        {deleteFor && (
          <>
            <h2 className="c-move-title">Удалить лекцию?</h2>
            <p className="c-move-sub">
              «{lectureTitle(deleteFor)}» попадёт в корзину на 30 дней. Одногруппники потеряют доступ сразу; при
              восстановлении доступ вернётся.
            </p>
            <div className="c-move-foot">
              <Button variant="ghost" onClick={() => setDeleteFor(null)}>
                Отмена
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const lec = deleteFor;
                  setDeleteFor(null);
                  scheduleDelete(`lecture:${lec.id}`, "Лекция в корзине", async () => {
                    await deleteLecture(lec.id);
                    notifyLecturesChanged();
                  });
                  options.onDeleted?.(lec);
                }}
              >
                Удалить
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );

  return {
    renamingId,
    cancelRename: () => setRenamingId(null),
    commitRename,
    menu,
    openSheet: (lecture: Lecture) => setSheetFor(lecture),
    itemsFor,
    dialogs,
    move,
    isHidden: (lecture: Lecture) => isPending(`lecture:${lecture.id}`),
  };
}
