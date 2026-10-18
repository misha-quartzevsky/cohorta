import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Мобильный HTTPS-режим запускается отдельной командой `npm run dev:https`
// (= `vite --mode https`). Обычный `npm run dev` остаётся на
// http://localhost:5173 — без самоподписанного сертификата на десктопе.
const isHttpsMode = (mode: string) => mode === 'https'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const https = isHttpsMode(mode)

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // main.tsx регистрирует SW вручную через '/sw.js' (graceful degradation
        // в dev). Инъекция скрипта отключена: она ссылалась на
        // /dev-dist/registerSW.js и падала с ENOENT, если dev-dist
        // очищается при работающем dev-сервере (vite-plugin-pwa
        // генерирует dev-dist только при старте).
        injectRegister: false,
        workbox: {
          // Добавлены шрифты (woff/woff2/ttf/otf/eot): MathLive и Excalidraw
          // грузятся локально и должны попадать в PWA-прекэш для офлайна.
          globPatterns: [
            '**/*.{js,css,html,ico,png,svg,json,woff,woff2,ttf,otf,eot}',
          ],
          // Основной бандл с MathLive (формулы) больше 2 MiB — поднимаем лимит
          // прекэша, иначе SW не добавит его и офлайн-открытие сломается.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          cleanupOutdatedCaches: true,
        },
        manifest: {
          name: 'cohorta — умные конспекты и заметки для студентов',
          short_name: 'cohorta',
          description: 'Сервис для студентов: конспекты, лекции и подготовка к экзаменам',
          start_url: '/',
          display: 'standalone',
          background_color: '#F7F7F5',
          theme_color: '#E86800',
          orientation: 'portrait-primary',
          icons: [
            {
              src: '/cohorta-app-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/cohorta-app-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/cohorta-app-icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
        includeAssets: [
          'favicon-16.png',
          'favicon-32.png',
          'favicon-48.png',
          'cohorta-app-icon-180.png',
          'icons.svg',
          'brand/*.svg',
        ],
      }),
      // Самоподписанный сертификат для dev-HTTPS. Нужен только в https-режиме.
      ...(https ? [basicSsl()] : []),
    ],
    resolve: {
      // Гарантируем один экземпляр React/tiptap даже при дубликатах в node_modules —
      // защита от ошибки «Invalid hook call»
      dedupe: ['react', 'react-dom', '@tiptap/react', '@tiptap/core', '@tiptap/pm'],
    },
    server: {
      // Bind to all interfaces so the app is reachable via
      // both IPv4 (127.0.0.1) and IPv6 (::1) localhost.
      host: true,
      ...(https
        ? {
            // В HTTPS-режиме телефоны открывают https://<LAN-IP>:5173. Чтобы
            // не ловить блокировку mixed content (https-страница → http-API),
            // этот же origin проксирует /api к локальному PocketBase
            // (127.0.0.1:8090). PocketBase при этом НЕ нужно перевыпускать на
            // 0.0.0.0 — он остаётся локальным, телефон ходит только к Vite.
            // .env.https задаёт пустой VITE_PB_URL (= same origin).
            proxy: {
              '/api': {
                target: 'http://127.0.0.1:8090',
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
  }
})