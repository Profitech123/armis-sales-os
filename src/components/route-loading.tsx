export default function RouteLoading() {
  return (
    <main className="app-shell" aria-busy="true" aria-live="polite">
      <div className="container">
        <div className="route-skeleton route-skeleton-title" />
        <div className="route-skeleton route-skeleton-panel" />
        <span className="sr-only">Loading page</span>
      </div>
    </main>
  );
}
