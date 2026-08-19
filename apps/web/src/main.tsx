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

import "./index.css";
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
