/** Ввод даты в виде ДД.ММ.ГГГГ (не зависит от языка браузера) ↔ ISO `YYYY-MM-DD`. */

/** Оставляет цифры и расставляет точки: «25012027» → «25.01.2027». */
export function maskRuDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

/** «25.01.2027» → «2027-01-25»; неполная или несуществующая дата → "". */
export function ruDateToIso(text: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const ok = d.getFullYear() === Number(yyyy) && d.getMonth() === Number(mm) - 1 && d.getDate() === Number(dd);
  return ok ? `${yyyy}-${mm}-${dd}` : "";
}

/** «2027-01-25» (или ISO с временем) → «25.01.2027»; пусто → "". */
export function isoToRuDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}
