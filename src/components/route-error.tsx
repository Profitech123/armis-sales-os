"use client";

import { useEffect } from "react";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="app-shell">
      <div className="container">
        <div className="empty-state" role="alert">
          <h2>We couldn&apos;t load this page</h2>
          <p>The data source may be temporarily unavailable. Please try again.</p>
          <button className="button dark" type="button" onClick={reset}>Try again</button>
        </div>
      </div>
    </main>
  );
}
