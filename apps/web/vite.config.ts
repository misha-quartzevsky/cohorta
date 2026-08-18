import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
        name: 'Cohorta — Умные конспекты и заметки для студентов',
        short_name: 'Cohorta',
        description: 'SaaS-сервис для студентов: конспекты, заметки и управление курсами в формате Notion',
        start_url: '/',
        display: 'standalone',
        background_color: '#f5f4fb',
        theme_color: '#5843f6',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/cohorta-black.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'maskable any',
          },
          {
            src: '/cohorta-black.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable any',
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.svg', 'cohorta-black.svg', 'icons.svg'],
    }),
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
  },
})