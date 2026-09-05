/**
 * ============================================
 *  examImport.ts — разбор вставленного списка билетов
 * ============================================
 *
 * Студент вставляет список вопросов одним куском — из Word,
 * Google Docs, чата. Даёт два независимых пути разбора:
 *
 *  - `parseTicketsFromHtml` — ОСНОВНОЙ, в два захода. Сначала
 *    настоящий `<ol>`/`<ul>` (Google Docs, большинство сайтов
 *    отдают в буфер обмен именно так — один `<li>` = один билет,
 *    структура уже решена форматом). Если такого списка нет —
 *    **псевдо-список Word**: Word кладёт нумерованный список в
 *    `text/html` НЕ как `<ol>`/`<li>`, а как обычные `<p>` с
 *    `style="mso-list:l0 level1 lfo1"` и служебным
 *    `<span style="mso-list:Ignore">1.</span>` внутри — сама
 *    нумерация нарисована CSS-счётчиком, а не разметкой. Без
 *    этого второго захода ЛЮБАЯ вставка прямо из Word проваливает
 *    основной путь и уходит в хрупкий текстовый разбор (баг,
 *    найденный на реальном использовании — см. тест на реальном
 *    Word-clipboard HTML).
 *
 *  - `parseTicketList` — ЗАПАСНОЙ, когда структуры нет вообще
 *    (обычный plain-text вставили руками или скопировали из
 *    мессенджера). Строки с маркером номера (`1.`, `2)`, `№3`,
 *    `Билет 4`) начинают билет; строка без маркера — продолжение
 *    предыдущего вопроса (Word/PDF рвут длинные формулировки
 *    переносами).
 *
 * Все три пути обязаны пройти через `cleanQuestionTail` — она
 * срезает `Ответственный: <Имя>` и отметку «✅», которыми
 * реальные списки билетов размечены прямо в тексте (ручной
 * учёт распределения билетов в общем документе). Без очистки
 * все билеты заканчивались бы чужим именем.
 *
 * Проверено на реальном списке билетов (философия, 40 вопросов):
 * настоящий `<ol>` даёт 40 из 40 без единой эвристики; тот же
 * список, сериализованный как Word кладёт его в буфер обмена
 * (псевдо-список), — тоже 40 из 40 через второй заход.
 */

export interface ParsedTicket {
  number: number;
  question: string;
}

/**
 * Срезает служебный хвост «Ответственный: Имя» и завершающую «✅»,
 * схлопывает переносы строк и лишние пробелы в один пробел.
 *
 * Схлопывание нужно потому, что `textContent` не делает того, что
 * делает CSS-рендер: длинный вопрос, перенесённый Word'ом на вторую
 * строку внутри одного `<p>`, приходит с буквальным «\n» в исходной
 * HTML-разметке — без нормализации он протекает в текст билета.
 */
export function cleanQuestionTail(raw: string): string {
  return raw
    .replace(/\s*Ответственн[^\s:]*\s*:.*$/isu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[✅✓]+\s*$/u, "")
    .trim();
}

/**
 * Word кладёт нумерованный список в буфер обмена не как `<ol>`/`<li>`,
 * а как обычные `<p style="mso-list:l0 level1 lfo1">` — сама нумерация
 * нарисована служебным `<span style="mso-list:Ignore">1.</span>` внутри
 * абзаца, а не разметкой списка. Номер вытаскивается из этого span (он
 * же затем удаляется, чтобы не задвоился в тексте вопроса); когда номер
 * не читается — считается по порядку.
 */
function parseWordPseudoList(doc: Document): ParsedTicket[] | null {
  const paragraphs = Array.from(doc.querySelectorAll<HTMLElement>("p")).filter(
    (p) => /mso-list\s*:/i.test(p.getAttribute("style") || "")
  );
  if (paragraphs.length === 0) return null;

  const tickets: ParsedTicket[] = [];
  let auto = 1;
  for (const p of paragraphs) {
    const clone = p.cloneNode(true) as HTMLElement;
    const marker = Array.from(clone.querySelectorAll<HTMLElement>("span")).find(
      (s) => /mso-list\s*:\s*ignore/i.test(s.getAttribute("style") || "")
    );
    let number = auto;
    if (marker) {
      const digits = /(\d{1,3})/.exec(marker.textContent || "");
      if (digits) number = Number(digits[1]);
      marker.remove();
    }
    const question = cleanQuestionTail(clone.textContent ?? "");
    if (question) {
      tickets.push({ number, question });
      auto = number + 1;
    }
  }
  return tickets.length > 0 ? tickets : null;
}

/**
 * Разбирает вставленный HTML: сначала настоящий `<ol>`/`<ul>`, затем
 * псевдо-список Word (см. `parseWordPseudoList`).
 *
 * @returns массив билетов, либо `null`, когда структуры в html нет
 *          вообще — вызывающий код тогда падает на текстовый разбор.
 */
export function parseTicketsFromHtml(html: string): ParsedTicket[] | null {
  const trimmed = html.trim();
  if (!trimmed) return null;

  const doc = new DOMParser().parseFromString(trimmed, "text/html");
  const list = doc.querySelector("ol, ul");
  if (list) {
    // Только пункты ЭТОГО списка — без вложенных под-списков (у вложенных
    // подвопросов своя нерешённая задача, см. заголовок файла плана).
    const items = Array.from(list.querySelectorAll(":scope > li"));
    const tickets: ParsedTicket[] = [];
    let number = 1;
    for (const li of items) {
      const clone = li.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("ol, ul").forEach((nested) => nested.remove());
      const question = cleanQuestionTail(clone.textContent ?? "");
      if (question) tickets.push({ number: number++, question });
    }
    if (tickets.length > 0) return tickets;
  }

  return parseWordPseudoList(doc);
}

/** Строка начинается с маркера номера: `1.` `2)` `№3` `1 -` `Билет 4`. */
const NUMBER_MARKER =
  /^\s*(?:билет\s+)?(?:№\s*)?(\d{1,3})\s*[.)\-:]?\s*(.*)$/iu;

/**
 * Запасной разбор: строки с маркером номера начинают билет,
 * строки без маркера — продолжение предыдущего.
 */
export function parseTicketList(text: string): ParsedTicket[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const hasAnyMarker = lines.some((l) => NUMBER_MARKER.test(l));

  const tickets: ParsedTicket[] = [];
  let auto = 1;

  for (const line of lines) {
    const m = hasAnyMarker ? NUMBER_MARKER.exec(line) : null;
    if (m) {
      const [, numStr, rest] = m;
      tickets.push({ number: Number(numStr), question: cleanQuestionTail(rest) });
    } else if (tickets.length > 0 && hasAnyMarker) {
      // Строка без маркера следом за билетом — перенос длинного вопроса.
      const last = tickets[tickets.length - 1];
      last.question = cleanQuestionTail(`${last.question} ${line}`);
    } else {
      tickets.push({ number: auto++, question: cleanQuestionTail(line) });
    }
  }

  return tickets.filter((t) => t.question.length > 0);
}

/**
 * Точка входа для превью импорта: пробует HTML, откатывается на
 * текст. Возвращает ещё и то, какой путь сработал — превью
 * показывает это как факт («Распознан список: 40 пунктов» против
 * «Разобрано по строкам»), см. план §2.
 */
export interface ImportResult {
  tickets: ParsedTicket[];
  source: "html-list" | "text-lines";
}

export function parseTicketsFromClipboard(html: string, text: string): ImportResult {
  const fromHtml = parseTicketsFromHtml(html);
  if (fromHtml) return { tickets: fromHtml, source: "html-list" };
  return { tickets: parseTicketList(text), source: "text-lines" };
}
