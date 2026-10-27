/** Shown while a page's data loads, including after a search, sort or period change. */
export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 rounded-lg bg-surface2" />
        <div className="h-4 w-72 max-w-full rounded bg-surface2" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card !p-4 sm:!p-5">
            <div className="h-3 w-20 rounded bg-surface2" />
            <div className="mt-4 h-6 w-28 rounded bg-surface2" />
          </div>
        ))}
      </div>
      <div className="card mt-6 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 rounded bg-surface2" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
