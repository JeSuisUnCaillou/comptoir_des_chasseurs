/** Shown in place of a comptoir page while the server renders it. */
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="link-spinner" aria-hidden="true" />
      <span className="eyebrow">Chargement…</span>
      <div className="skeleton skeleton-title" aria-hidden="true" />
      <div className="skeleton" aria-hidden="true" />
      <div className="skeleton" aria-hidden="true" />
      <div className="skeleton skeleton-short" aria-hidden="true" />
    </div>
  );
}
