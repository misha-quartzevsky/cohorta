import { useEffect, useState } from "react";
import { FormDialog, Select, Textarea } from "../../ui";
import { createDeckCard, setDeckCardPosition } from "../../services/deckService";
import { errorMessage } from "../../lib/format";
import { plainToHtml, lectureOptionLabel } from "../../lib/cardText";
import { fetchAllLectures } from "../../services/lectureService";
import { pb } from "../../lib/pocketbase";
import { lectureCourseId, lectureTitle, type Lecture } from "../../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  deckId: string;
  deckTitle: string;
  /** Предмет колоды: если есть, в списке лекции только этого предмета; иначе все мои. */
  subjectId?: string;
  /** Сколько карточек уже в колоде: новая встаёт в конец. */
  cardCount: number;
  /** После каждого сохранения (в том числе «Сохранить и ещё») — обновить список. */
  onSaved: () => void;
}

/**
 * «Новая карточка» (Screen-forms-create, Screen-m-form-card): вопрос, ответ и необязательная
 * лекция (`deck_cards.lecture`). В списке только свои лекции: правило базы чужую не примет.
 */
export default function CardFormDialog({ open, onClose, deckId, deckTitle, subjectId, cardCount, onSaved }: Props) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [frontError, setFrontError] = useState("");
  const [backError, setBackError] = useState("");
  const [saved, setSaved] = useState(0);
  const [lecture, setLecture] = useState("");
  const [lectures, setLectures] = useState<Lecture[]>([]);

  useEffect(() => {
    if (!open) return;
    setFront("");
    setBack("");
    setFrontError("");
    setBackError("");
    setSaved(0);
    setLecture("");
    const me = String(pb.authStore.record?.id ?? "");
    void fetchAllLectures()
      .then((all) =>
        setLectures(
          all.filter((l) => String(l.owner ?? "") === me && (!subjectId || lectureCourseId(l) === subjectId))
        )
      )
      .catch(() => setLectures([]));
  }, [open, subjectId]);

  /** Записывает карточку; false — не вышло, ошибка показана в форме. */
  async function save(): Promise<boolean> {
    const q = front.trim();
    const a = back.trim();
    setFrontError(q ? "" : "Введи вопрос");
    setBackError(a ? "" : "Введи ответ");
    if (!q || !a) return false;
    try {
      const card = await createDeckCard(deckId, plainToHtml(q), plainToHtml(a), lecture || undefined);
      await setDeckCardPosition(card.id, cardCount + saved);
      onSaved();
      return true;
    } catch (e) {
      setBackError("Не удалось сохранить карточку: " + errorMessage(e));
      return false;
    }
  }

  async function saveAndNext() {
    const ok = await save();
    if (!ok) return false;
    setSaved((n) => n + 1);
    setFront("");
    setBack("");
    return false; // окно остаётся открытым
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Новая карточка"
      subtitle={`Колода «${deckTitle}»`}
      submitLabel="Сохранить"
      onSubmit={save}
      secondary={{
        label: (
          <>
            <span className="c-hide-phone">Сохранить и ещё</span>
            <span className="c-show-phone">Сохранить и добавить ещё</span>
          </>
        ),
        onClick: saveAndNext,
      }}
    >
      <Textarea
        label="Вопрос"
        value={front}
        onChange={(e) => {
          setFront(e.target.value);
          setFrontError("");
        }}
        rows={3}
        error={frontError || undefined}
        autoFocus
      />
      <Textarea
        label="Ответ"
        value={back}
        onChange={(e) => {
          setBack(e.target.value);
          setBackError("");
        }}
        placeholder="Короткий ответ"
        rows={4}
        hint={saved > 0 ? `Сохранено карточек: ${saved}` : undefined}
        error={backError || undefined}
      />
      <Select
        label="Лекция · необязательно"
        value={lecture}
        onChange={(e) => setLecture(e.target.value)}
        hint="Покажется на карточке при повторении."
      >
        <option value="">Без лекции</option>
        {lectures.map((l) => (
          <option key={l.id} value={l.id}>
            {lectureOptionLabel({ number: l.number, title: lectureTitle(l) })}
          </option>
        ))}
      </Select>
    </FormDialog>
  );
}
