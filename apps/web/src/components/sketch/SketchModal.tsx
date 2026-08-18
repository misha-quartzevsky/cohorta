/**
 * ============================================
 *  SketchModal.tsx — модалка Excalidraw для рукописных схем
 * ============================================
 *
 * Excalidraw загружается лениво (React.lazy), поэтому не раздувает
 * основной бандл. Шрифты Excalidraw — локальные (public/excalidraw-fonts),
 * чтобы работал PWA-прекэш и офлайн.
 *
 * Экспорт схемы — SVG с ПРОЗРАЧНЫМ фоном (exportBackground: false), чтобы
 * на стеклянной/градиентной подложке лекции схема не выглядела «белым
 * пятном». Изображение загружается в поле `file` лекции через
 * onUploadImages; сцена (JSON) сохраняется в атрибут блока для повторного
 * редактирования.
 */

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

import type { SketchRequest } from "./sketchBus";

// Локальные шрифты Excalidraw: путь задаём ДО того, как пакет начнёт
// подтягивать ассеты (иначе в проде улетит на CDN).
if (typeof window !== "undefined") {
  (
    window as unknown as { EXCALIDRAW_ASSET_PATH?: string }
  ).EXCALIDRAW_ASSET_PATH = "/excalidraw-fonts/";
}

const Excalidraw = lazy(() =>
  import("@excalidraw/excalidraw").then((module) => {
    // CSS Excalidraw тоже должен уйти в ленивый чанк, вместе с библиотекой.
    void import("@excalidraw/excalidraw/index.css");
    return { default: module.Excalidraw };
  })
);

interface Props {
  request: SketchRequest;
  onClose: () => void;
}

export default function SketchModal({ request, onClose }: Props) {
  const apiRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initialData, setInitialData] = useState<{
    elements: unknown[];
  } | null>(request.scene ? null : { elements: [] });

  // Восстанавливаем сохранённую сцену (динамический импорт Excalidraw —
  // чтобы вся библиотека жила только в ленивом чанке модалки).
  useEffect(() => {
    if (!request.scene) {
      setInitialData({ elements: [] });
      return;
    }
    const scene = request.scene;
    let cancelled = false;
    setInitialData(null);
    void import("@excalidraw/excalidraw").then((module) => {
      if (cancelled) return;
      try {
        const parsed = JSON.parse(scene);
        if (parsed && Array.isArray(parsed.elements)) {
          const restored = module.restore(parsed, null, null);
          setInitialData({ elements: restored.elements });
          return;
        }
      } catch {
        /* повреждённая сцена — открываем пустую */
      }
      setInitialData({ elements: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [request.scene]);

  const close = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);

  // Escape закрывает модалку.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Собираем элементы и экспортируем SVG с прозрачным фоном.
  const handleSave = async () => {
    const api = apiRef.current;
    if (!api) return;
    setSaving(true);
    setError("");
    try {
      const { exportToSvg } = await import("@excalidraw/excalidraw");
      const elements = api.getSceneElements() as readonly unknown[];
      // Пустая схема (ничего не нарисовано) — просто закрываем без изменений.
      if (!elements.length) {
        onClose();
        return;
      }
      const appState = api.getAppState() ?? {};
      const files = api.getFiles() ?? {};
      const sceneJson = JSON.stringify({ elements, appState, files });

      const svg = await exportToSvg({
        elements: elements as never,
        appState: {
          ...appState,
          exportBackground: false,
          exportWithDarkMode: false,
        } as never,
        files: files as never,
        exportPadding: 12,
      });
      const svgStr = new XMLSerializer().serializeToString(svg);

      let src: string;
      if (request.onUploadImages) {
        const blob = new Blob([svgStr], {
          type: "image/svg+xml;charset=utf-8",
        });
        const file = new File(
          [blob],
          `sketch-${Date.now()}.svg`,
          { type: "image/svg+xml" }
        );
        const [uploaded] = await request.onUploadImages([file]);
        src = uploaded?.url ?? "";
      } else {
        src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
      }

      const { editor, pos } = request;
      const nodeAtPos = editor.state.doc.nodeAt(pos);
      if (nodeAtPos?.type.name === "sketchBlock") {
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .updateAttributes("sketchBlock", { src, scene: sceneJson })
          .run();
      } else {
        editor
          .chain()
          .focus()
          .insertContentAt(pos, {
            type: "sketchBlock",
            attrs: { src, scene: sceneJson },
          })
          .run();
      }
      editor.commands.setTextSelection(pos + 1);
      editor.commands.focus();
      onClose();
    } catch (e) {
      console.error("Ошибка сохранения схемы:", e);
      setError("Не удалось сохранить схему");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="sketch-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="sketch-modal">
        <div className="sketch-modal-head">
          <span className="sketch-modal-title">Схема</span>
          <button
            type="button"
            className="sketch-modal-close"
            onClick={close}
            title="Закрыть (Esc)"
          >
            <X size={16} />
          </button>
        </div>
        <div className="sketch-modal-canvas">
          <Suspense
            fallback={
              <div className="sketch-loading">
                <Loader2 size={20} className="spin" /> Загрузка…
              </div>
            }
          >
            {initialData && (
              <Excalidraw
                excalidrawAPI={(api) => {
                  apiRef.current = api;
                }}
                initialData={initialData as never}
                langCode="ru-RU"
                theme="light"
              />
            )}
          </Suspense>
        </div>
        {error && <div className="sketch-error">{error}</div>}
        <div className="sketch-modal-actions">
          <button
            type="button"
            className="btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Сохраняем…" : "Сохранить схему"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={close}
            disabled={saving}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}