"use client";

import "./globals.css";

// Replaces the root layout when it crashes, so it carries its own <html>.
export default function GlobalError({ retry }: { error: Error; retry: () => void }) {
  return (
    <html lang="en-IN">
      <body className="min-h-dvh">
        <main
          role="alert"
          className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-start justify-center gap-4 px-4"
        >
          <h1 className="type-lid text-[2.2rem]">Something broke on our side</h1>
          <p className="text-muted">The page failed to load. Trying again usually fixes it.</p>
          <button type="button" onClick={() => retry()} className="btn btn-ink">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
