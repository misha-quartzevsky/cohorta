/**
 * ============================================
 *  CardSkeleton.tsx — local lecture-card skeleton
 * ============================================
 *
 * A lightweight placeholder shown inside the white lecture card while its data
 * is loading. Unlike the old full-screen <LoadingState/>, it keeps the header,
 * sidebar and TOC mounted — so switching lectures doesn't blink the whole app.
 */

export default function CardSkeleton() {
  return (
    <div className="lecture-card" aria-busy="true" aria-label="Загрузка">
      <div className="card-skeleton">
        <div className="skeleton-line skeleton-meta" />
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-short" />
      </div>
    </div>
  );
}
