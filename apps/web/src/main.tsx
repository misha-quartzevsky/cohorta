import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Advanced Capture Tools:
//  - mathlive регистрирует кастомные элементы <math-field>/<math-span>/<math-div>
//    (формулы в редакторе и в просмотре);
//  - static.css = шрифты KaTeX + стили статичного рендера (.ML__*)
//    + флаг `--ML__static-fonts:true`. Без этого mathlive пытается сам качать
//    шрифты через FontFace API (нужен fontsDirectory), а статичные
//    `<math-div>` остаются невидимыми/сломаными в режиме чтения.
import "mathlive";
import "mathlive/static.css";

// Локальные шрифты Excalidraw (схемы) — для офлайна и без CDN.
if (typeof window !== "undefined") {
  // Вешаем путь на window до импорта @excalidraw/excalidraw.
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = "/excalidraw-fonts/";
}

// Inter локально через @fontsource (A1, 2026-10-18) — без внешнего
// Google Fonts CDN (раздел 3 инструкции). Дизайн-система нужна
// только в 400/500/600, но старый App.css (живые экраны, волна B)
// местами ставит font-weight:700 — без него браузер синтезировал
// бы псевдо-жирный. 700 убрать вместе с App.css в волне D.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/cyrillic-400.css";
import "@fontsource/inter/cyrillic-500.css";
import "@fontsource/inter/cyrillic-600.css";
import "@fontsource/inter/cyrillic-700.css";

import "./index.css";
// App.css (легась, волна B) импортируется здесь явно, ДО tokens.css —
// иначе отложенный `import "./App.css"` внутри App.tsx грузится позже
// в графе модулей и его :root переопределяет новые токены по общим
// именам (--ink, --bg, --danger…). Новые токены должны побеждать.
import "./App.css";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/group.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for PWA support (production only).
// В dev проект использует `vite-plugin-pwa` с `devOptions.enabled: true`,
// из‑за чего `/sw.js` держит «старый снапшот» и ломает reload / SPA‑refocus
// (.clinerules, «белый экран при обновлении»). Поэтому в dev SW не
// регистрируем, а при переходе в dev принудительно сбрасываем любые
// ранее‑зарегистрированные SW — чтобы они больше не контролировали вкладку.
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered: ", registration);
        })
        .catch((registrationError) => {
          console.log("SW registration failed: ", registrationError);
        });
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      void Promise.all(
        registrations.map((registration) => registration.unregister())
      ).then((ok) => {
        if (ok.some(Boolean)) {
          console.log("SW unregistered in dev");
        }
      });
    });
  }
}
