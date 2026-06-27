"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <main style={{ margin: "0 auto", maxWidth: 720, padding: 48 }}>
          <p>{error.digest ? `Error ${error.digest}` : "Global error"}</p>
          <h1>Application error</h1>
          <p>The root application shell failed to render.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
