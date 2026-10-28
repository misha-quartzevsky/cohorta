export {};

declare global {
  interface Window {
    /** Путь к локальным шрифтам Excalidraw: ставится в main.tsx до загрузки пакета. */
    EXCALIDRAW_ASSET_PATH?: string;
  }
}
