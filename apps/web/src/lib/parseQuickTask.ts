import { toDateStr, addDays, weekdayMon1 } from "./localDate";

export interface SubjectRef {
  id: string;
  name: string;
}

export interface ParsedQuickTask {
  /** Название без распознанной фразы срока. */
  title: string;
  /** YYYY-MM-DD или null. */
  due: string | null;
  /** Человекочитаемая подпись срока для Badge. */
  dueLabel: string | null;
  /** id предмета или null. */
  subjectId: string | null;
}

const MONTHS: Record<string, number> = {
  январ: 0,
  феврал: 1,
  март: 2,
  апрел: 3,
  ма: 4, // мая/май
  июн: 5,
  июл: 6,
  август: 7,
  сентябр: 8,
  октябр: 9,
  ноябр: 10,
  декабр: 11,
};

const MONTH_LABEL = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

// Понедельник=1 … воскресенье=7; ключ — стем для «до пятницы»/«в пятницу».
const WEEKDAYS: { stem: string; n: number; label: string }[] = [
  { stem: "понедельник", n: 1, label: "понедельник" },
  { stem: "вторник", n: 2, label: "вторник" },
  { stem: "сред", n: 3, label: "среду" },
  { stem: "четверг", n: 4, label: "четверг" },
  { stem: "пятниц", n: 5, label: "пятницу" },
  { stem: "суббот", n: 6, label: "субботу" },
  { stem: "воскресень", n: 7, label: "воскресенье" },
];

function stem(word: string): string {
  const w = word.toLowerCase();
  return w.length > 5 ? w.slice(0, w.length - 2) : w;
}

/**
 * Разбор быстрой задачи (spec 5.1). Чистая функция.
 * Распознаёт «сегодня», «завтра», «послезавтра», «до/в WEEKDAY»,
 * «до? DD МЕСЯЦ», «до? DD.MM(.YYYY)». Срок убирается из названия,
 * предмет определяется по подстроке/стему и в названии остаётся.
 */
export function parseQuickTask(
  text: string,
  today: Date,
  subjects: SubjectRef[]
): ParsedQuickTask {
  let working = text;
  let due: string | null = null;
  let dueLabel: string | null = null;

  function setDue(date: Date, label: string, matched: string) {
    due = toDateStr(date);
    dueLabel = label;
    working = working.replace(matched, " ");
  }

  // 1. DD МЕСЯЦ (с опциональным «до»)
  const monthRe =
    /(?:^|\s)((?:до\s+)?(\d{1,2})\s+([а-яё]+))/iu;
  const mMonth = monthRe.exec(working);
  if (mMonth) {
    const phrase = mMonth[1];
    const day = parseInt(mMonth[2], 10);
    const monthWord = mMonth[3].toLowerCase();
    const key = Object.keys(MONTHS).find((k) => monthWord.startsWith(k));
    if (key && day >= 1 && day <= 31) {
      const month = MONTHS[key];
      let year = today.getFullYear();
      const candidate = new Date(year, month, day, 12);
      // Если дата уже прошла в этом году — берём следующий год.
      if (candidate.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
        year += 1;
      }
      setDue(new Date(year, month, day, 12), `${day} ${MONTH_LABEL[month]}`, phrase);
    }
  }

  // 2. DD.MM(.YYYY)
  if (!due) {
    const numRe = /(?:^|\s)((?:до\s+)?(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?)/u;
    const mNum = numRe.exec(working);
    if (mNum) {
      const phrase = mNum[1];
      const day = parseInt(mNum[2], 10);
      const month = parseInt(mNum[3], 10) - 1;
      let year = mNum[4]
        ? parseInt(mNum[4].length === 2 ? `20${mNum[4]}` : mNum[4], 10)
        : today.getFullYear();
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (!mNum[4] && new Date(year, month, day).getTime() < base.getTime()) {
          year += 1;
        }
        setDue(new Date(year, month, day, 12), `${day} ${MONTH_LABEL[month]}`, phrase);
      }
    }
  }

  // 3. Относительные. ВАЖНО: \b в JS не распознаёт кириллицу даже с флагом u,
  // поэтому границы слова задаём через (^|\s) и (?=\s|$|пунктуация).
  if (!due) {
    const rel: [RegExp, number, string][] = [
      [/(?:^|\s)(послезавтра)(?=\s|$|[.,!?])/iu, 2, "послезавтра"],
      [/(?:^|\s)(завтра)(?=\s|$|[.,!?])/iu, 1, "завтра"],
      [/(?:^|\s)(сегодня)(?=\s|$|[.,!?])/iu, 0, "сегодня"],
    ];
    for (const [re, delta, label] of rel) {
      const m = re.exec(working);
      if (m) {
        setDue(addDays(today, delta), label, m[1]);
        break;
      }
    }
  }

  // 4. День недели («до пятницы», «в пятницу»)
  if (!due) {
    for (const wd of WEEKDAYS) {
      const re = new RegExp(
        `(?:^|\\s)((?:до|в|к|во)\\s+${wd.stem}[а-яё]*)`,
        "iu"
      );
      const m = re.exec(working);
      if (m) {
        const curr = weekdayMon1(today);
        let delta = wd.n - curr;
        if (delta <= 0) delta += 7;
        setDue(addDays(today, delta), wd.label, m[1]);
        break;
      }
    }
  }

  // Предмет: подстрока или стем первого слова названия.
  let subjectId: string | null = null;
  const lower = text.toLowerCase();
  const textStems = lower.split(/[^а-яёa-z0-9]+/iu).filter(Boolean).map(stem);
  // Предпочитаем более длинное название (более специфичное).
  const ordered = [...subjects].sort((a, b) => b.name.length - a.name.length);
  for (const s of ordered) {
    const name = s.name.toLowerCase();
    if (name && lower.includes(name)) {
      subjectId = s.id;
      break;
    }
    const firstWord = name.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 4) {
      const fs = stem(firstWord);
      if (textStems.some((t) => t === fs || t.startsWith(fs) || fs.startsWith(t))) {
        subjectId = s.id;
        break;
      }
    }
  }

  const title = working.replace(/\s{2,}/g, " ").trim();

  return { title, due, dueLabel, subjectId };
}
