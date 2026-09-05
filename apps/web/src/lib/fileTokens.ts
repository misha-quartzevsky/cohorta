/**
 * ============================================
 *  fileTokens.ts — портативные ссылки на файлы PocketBase
 * ============================================
 *
 * В базе картинка внутри rich-контента хранится не абсолютным
 * URL, а токеном `[[file:имя]]`. Иначе контент привязывается к
 * хосту: база, снятая с 127.0.0.1, ломается на LAN-адресе и в
 * проде (в проекте эта грабля уже была — застарелый VITE_PB_URL).
 *
 * На границах контент разворачивается в URL и сворачивается
 * обратно. Здесь эти преобразования сделаны независимыми от
 * коллекции — принимают любую запись PocketBase.
 *
 * ПРИМЕЧАНИЕ: те же преобразования сейчас продублированы в
 * `lectureService` (для lectures.file) и в `deckService` (для
 * deck_cards.attachments). Оба — кандидаты переехать сюда;
 * трогать их вместе с новым модулем не стали, чтобы не
 * рисковать зелёными тестами.
 */

import { pb } from "./pocketbase";
import type { PbRecord } from "./types";

const IMG_TOKEN_RE = /\[\[file:([^\]]+)\]\]/g;

/** Разворачивает `[[file:имя]]` в абсолютные URL файлов записи. */
export function resolveFileTokensFor(html: string, record: PbRecord): string {
  return html.replace(IMG_TOKEN_RE, (_m, name: string) =>
    pb.files.getURL(record, name)
  );
}

/**
 * Сворачивает `src`, указывающие на собственные файлы записи,
 * обратно в токены `[[file:имя]]`.
 *
 * @param html       — rich-контент
 * @param record     — запись-владелец файлов
 * @param collection — имя коллекции (запасной вариант, если
 *                     `collectionId` у записи не заполнен)
 */
export function tokenizeFileUrlsFor(
  html: string,
  record: PbRecord,
  collection: string
): string {
  const collectionId = String(record.collectionId ?? collection);
  const escapedId = record.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(src=["'][^"']*/api/files/(?:${collectionId}|${collection})/${escapedId}/)([^/?"']+)([^"']*)(["'])`,
    "g"
  );
  return html.replace(
    re,
    (_m, _prefix: string, name: string, _rest: string, quote: string) => {
      let decoded = name;
      try {
        decoded = decodeURIComponent(name);
      } catch {
        /* оставляем как есть */
      }
      return `src=${quote}[[file:${decoded}]]${quote}`;
    }
  );
}

/**
 * Превращает «голый» URL файла PocketBase, оказавшийся в тексте,
 * в настоящий `<img>`. URL, уже стоящие внутри `src`/`href`,
 * не трогаются — их отсекает negative lookbehind по кавычке/`=`.
 */
export function embedBareFileUrls(html: string): string {
  const fileUrl = String.raw`(?:https?:\/\/[^\s'"<>]*)?\/api\/files\/[A-Za-z0-9_]+\/[A-Za-z0-9]+\/[^\s'"<>]+`;
  const re = new RegExp(`(?<![A-Za-z0-9_'"=])(${fileUrl})`, "g");
  return html.replace(re, (_m, url: string) => {
    const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return `<img src="${escaped}" alt="" class="card-inline-img" />`;
  });
}
