/**
 * Подсветка совпадения в результате поиска (Screen-search.dc.html:
 * «<b>До</b>говор»). Первое вхождение, без учёта регистра, без HTML —
 * безопасно для пользовательских названий.
 */
export function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <b>{text.slice(index, index + q.length)}</b>
      {text.slice(index + q.length)}
    </>
  );
}
