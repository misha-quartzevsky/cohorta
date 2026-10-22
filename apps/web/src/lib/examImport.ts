/**
 * ============================================
 *  examImport.ts — разбор вставленного списка билетов
 * ============================================
 *
 * Студент вставляет список вопросов одним куском — из Word, Google Docs, чата.
 *
 * Правила (решение владелицы 21.10):
 *  - Один билет на строку (или один пункт списка). Все непустые строки становятся билетами,
 *    ни одна не пропускается и не склеивается с соседней; одинаковые названия — два билета.
 *  - Цифры в начале строк — не номера билетов: «1.», «1)», «1 –», «1:», табы, маркеры списка
 *    убираются. Номера билетов назначаются при добавлении: следующие после уже существующих
 *    (`numberAfter`), в порядке текста.
 *
 * Пути разбора:
 *  - `parseTicketsFromHtml` — настоящий `<ol>`/`<ul>` (Google Docs, сайты: один `<li>` = один
 *    билет) и псевдо-список Word (`<p style="mso-list:…">` со служебным `<span mso-list:Ignore>`).
 *    Нужен, потому что длинный вопрос внутри одного пункта может содержать перенос строки.
 *  - `parseTicketList` — обычный текст: одна строка = один билет.
 *
 * Все пути проходят через `cleanQuestionTail`: она срезает `Ответственный: <Имя>` и отметку «✅»
 * (ручной учёт распределения билетов в общем документе).
 */

export interface ParsedTicket {
  /** Позиция в тексте, с единицы. Настоящий номер билета назначает `numberAfter`. */
  number: number;
  question: string;
}

/**
 * Срезает служебный хвост «Ответственный: Имя» и завершающую «✅», схлопывает переносы строк
 * и лишние пробелы в один пробел.
 */
export function cleanQuestionTail(raw: string): string {
  return raw
    .replace(/\s*Ответственн[^\s:]*\s*:.*$/isu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[✅✓]+\s*$/u, "")
    .trim();
}

/** Маркеры списка в начале строки: • · ▪ ● ○ ◦ ■ □ * - – —. */
const BULLET = /^[\s•·▪●○◦■□*\-–—]+(?=\S)/u;
/** Номер с разделителем: «1.» «1)» «1]» «1:» «1 –» «1 -» «№3» «Билет 4» (и «билет №4.»). */
const NUMBER_WITH_MARK = /^\s*(?:билет\s*)?(?:№\s*)?\d{1,3}\s*(?:[.)\]:]+\s*|[-–—]+\s+)/iu;
/** Голый номер и пробел или таб: «12 Оферта». */
const NUMBER_BARE = /^\s*\d{1,3}[\s\t]+(?=\S)/u;
/** «Билет 4 Оферта», «№3 Оферта» без разделителя. */
const NUMBER_WORD = /^\s*(?:билет\s+\d{1,3}|№\s*\d{1,3})\s+(?=\S)/iu;

/**
 * Убирает ведущую нумерацию и маркеры. Голый номер с пробелом («12 Оферта») убирается только когда
 * так начинается почти весь список (`bare`): иначе билет, чей текст сам начинается с числа
 * («7 сил Портера»), потерял бы слово.
 */
export function stripTicketNumbering(line: string, bare = false): string {
  let s = line.trim();
  for (let i = 0; i < 3; i += 1) {
    const before = s;
    s = s.replace(BULLET, "");
    if (NUMBER_WITH_MARK.test(s)) s = s.replace(NUMBER_WITH_MARK, "");
    else if (NUMBER_WORD.test(s)) s = s.replace(NUMBER_WORD, "");
    else if (bare && NUMBER_BARE.test(s)) s = s.replace(NUMBER_BARE, "");
    if (s === before) break;
  }
  return s.trim();
}

/** Список считается «пронумерованным голыми числами», если так начинаются почти все строки (от 2 строк, 70%). */
function isBareNumbered(lines: string[]): boolean {
  if (lines.length < 2) return false;
  const hit = lines.filter((l) => NUMBER_BARE.test(l.replace(BULLET, ""))).length;
  return hit / lines.length >= 0.7;
}

/** Нумерует по порядку, отбрасывает пустые. */
function toTickets(questions: string[]): ParsedTicket[] {
  const out: ParsedTicket[] = [];
  for (const q of questions) {
    const question = cleanQuestionTail(q);
    if (question) out.push({ number: out.length + 1, question });
  }
  return out;
}

/** Word кладёт нумерованный список как `<p style="mso-list:…">` со служебным `<span mso-list:Ignore>1.</span>`. */
function parseWordPseudoList(doc: Document): ParsedTicket[] | null {
  const paragraphs = Array.from(doc.querySelectorAll<HTMLElement>("p")).filter((p) =>
    /mso-list\s*:/i.test(p.getAttribute("style") || "")
  );
  if (paragraphs.length === 0) return null;

  const raws: string[] = [];
  for (const p of paragraphs) {
    const clone = p.cloneNode(true) as HTMLElement;
    Array.from(clone.querySelectorAll<HTMLElement>("span"))
      .filter((s) => /mso-list\s*:\s*ignore/i.test(s.getAttribute("style") || ""))
      .forEach((s) => s.remove());
    raws.push(stripTicketNumbering(clone.textContent ?? ""));
  }
  const tickets = toTickets(raws);
  return tickets.length > 0 ? tickets : null;
}

/**
 * Разбирает вставленный HTML: сначала настоящий `<ol>`/`<ul>`, затем псевдо-список Word.
 * @returns билеты либо `null`, когда структуры в html нет — тогда разбор идёт по тексту.
 */
export function parseTicketsFromHtml(html: string): ParsedTicket[] | null {
  const trimmed = html.trim();
  if (!trimmed) return null;

  const doc = new DOMParser().parseFromString(trimmed, "text/html");
  const list = doc.querySelector("ol, ul");
  if (list) {
    const items = Array.from(list.querySelectorAll(":scope > li"));
    const raws: string[] = [];
    for (const li of items) {
      const clone = li.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("ol, ul").forEach((nested) => nested.remove());
      raws.push(stripTicketNumbering(clone.textContent ?? ""));
    }
    const tickets = toTickets(raws);
    if (tickets.length > 0) return tickets;
  }

  return parseWordPseudoList(doc);
}

/** Текстовый разбор: одна непустая строка = один билет, ведущая нумерация убирается. */
export function parseTicketList(text: string): ParsedTicket[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const bare = isBareNumbered(lines);
  return toTickets(lines.map((l) => stripTicketNumbering(l, bare)));
}

/**
 * Назначает номера билетам: следующие после наибольшего из уже существующих, в порядке текста
 * (были 1–3: новые получают 4, 5, 6…).
 */
export function numberAfter(tickets: readonly ParsedTicket[], existingNumbers: Iterable<number>): ParsedTicket[] {
  let max = 0;
  for (const n of existingNumbers) if (Number.isFinite(n) && n > max) max = n;
  return tickets.map((t, i) => ({ number: max + i + 1, question: t.question }));
}

export interface ImportResult {
  tickets: ParsedTicket[];
  source: "html-list" | "text-lines";
}

/** Точка входа для превью импорта: пробует HTML, откатывается на текст. */
export function parseTicketsFromClipboard(html: string, text: string): ImportResult {
  const fromHtml = parseTicketsFromHtml(html);
  if (fromHtml) return { tickets: fromHtml, source: "html-list" };
  return { tickets: parseTicketList(text), source: "text-lines" };
}
