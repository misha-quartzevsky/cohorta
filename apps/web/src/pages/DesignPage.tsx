import { useState } from "react";
import { MoreHorizontal, Link2, Trash2 } from "lucide-react";
import {
  Button,
  IconButton,
  Badge,
  Input,
  Textarea,
  Select,
  SegmentedControl,
  Checkbox,
  Card,
  Callout,
  ProgressBar,
  Skeleton,
  Modal,
  Menu,
  EmptyState,
  SubjectCover,
  useToast,
} from "../components/ui";
import { SUBJECT_PALETTES, type SubjectPaletteKey } from "../lib/subjectPalette";

/**
 * Витрина дизайн-основы (/_design). Только в dev-сборке (см. App.tsx).
 * Для визуальной проверки компонентов в обоих крайних размерах.
 */
export default function DesignPage() {
  const [seg, setSeg] = useState("today");
  const [checked, setChecked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  return (
    <div className="ds-root" style={{ padding: "var(--space-5)", maxWidth: 960, margin: "0 auto" }}>
      <h1 className="ds-display">Дизайн-основа</h1>
      <p className="ds-body ds-muted" style={{ marginBottom: "var(--space-6)" }}>
        Витрина компонентов. Проверять на 320 и 1280 px.
      </p>

      <Section title="Типографика">
        <p className="ds-display">Display 38</p>
        <p className="ds-h1">Heading 1 — 30</p>
        <p className="ds-h2">Heading 2 — 24</p>
        <p className="ds-h3">Heading 3 — 20</p>
        <p className="ds-body">Body 14 — основной интерфейс.</p>
        <p className="ds-caption ds-subtle-text">Caption 13 — подписи.</p>
        <p className="ds-overline">Overline</p>
      </Section>

      <Section title="Кнопки">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger-text">Удалить</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Ещё">
            <MoreHorizontal size={18} />
          </IconButton>
        </Row>
      </Section>

      <Section title="Плашки">
        <Row>
          <Badge tone="neutral">Новая</Badge>
          <Badge tone="accent">Начать конспект</Badge>
          <Badge tone="success">Готово</Badge>
          <Badge tone="danger">Повторить</Badge>
        </Row>
      </Section>

      <Section title="Поля">
        <div style={{ display: "grid", gap: "var(--space-4)", maxWidth: 360 }}>
          <Input label="Название" placeholder="Лекция 6" />
          <Input label="С ошибкой" error="Заполни поле" defaultValue="" />
          <Textarea label="Заметка" placeholder="Текст…" />
          <Select label="Тип">
            <option>Лекция</option>
            <option>Семинар</option>
          </Select>
        </div>
      </Section>

      <Section title="Сегмент-контрол">
        <SegmentedControl
          segments={[
            { value: "today", label: "Сегодня", count: 3 },
            { value: "soon", label: "Скоро", count: 5 },
            { value: "all", label: "Все" },
          ]}
          value={seg}
          onChange={setSeg}
        />
      </Section>

      <Section title="Чекбокс и меню">
        <Row>
          <Checkbox checked={checked} onChange={setChecked} label="Задача" />
          <Menu
            trigger={({ ref, onClick, ...aria }) => (
              <button
                ref={ref}
                type="button"
                className="ds-icon-btn"
                aria-label="Меню"
                onClick={onClick}
                {...aria}
              >
                <MoreHorizontal size={18} />
              </button>
            )}
            items={[
              { label: "Привязать к лекции", icon: <Link2 size={16} />, onClick: () => {} },
              { label: "Удалить", icon: <Trash2 size={16} />, onClick: () => {}, danger: true },
            ]}
          />
        </Row>
      </Section>

      <Section title="Карточка и врезка">
        <Card>
          <h3 className="ds-h3">Карточка</h3>
          <p className="ds-body ds-muted">Фон card, рамка line, radius xl.</p>
        </Card>
        <Callout label="Определение">
          Врезка с фоном subtle, без цветной полосы слева.
        </Callout>
      </Section>

      <Section title="Прогресс и скелетон">
        <ProgressBar value={72} />
        <ProgressBar value={40} color="var(--color-danger)" thin />
        <Skeleton height={48} />
      </Section>

      <Section title="Обложки предметов">
        <Row>
          {(Object.keys(SUBJECT_PALETTES) as SubjectPaletteKey[]).map((k) => (
            <SubjectCover key={k} subjectId={k} paletteKey={k} size={72} />
          ))}
        </Row>
      </Section>

      <Section title="Модал и тост">
        <Row>
          <Button onClick={() => setModalOpen(true)}>Открыть модал</Button>
          <Button variant="secondary" onClick={() => toast.show("Задача добавлена", { label: "Открыть", onClick: () => {} })}>
            Показать тост
          </Button>
        </Row>
      </Section>

      <Section title="Пустое состояние">
        <EmptyState
          title="Задач пока нет"
          text="Добавь первую — или начни с подсказки."
          actions={<Button>Создать задачу</Button>}
        />
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Пример окна"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => setModalOpen(false)}>Сохранить</Button>
          </>
        }
      >
        <Input label="Поле" placeholder="…" />
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--space-6)", display: "grid", gap: "var(--space-3)" }}>
      <h2 className="ds-h2">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
      {children}
    </div>
  );
}
