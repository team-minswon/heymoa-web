"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-sm text-muted-foreground">
        {error.digest ? `Error ${error.digest}` : "Error"}
      </p>
      <h1 className="mt-4 text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-4 text-muted-foreground">
        The app foundation caught an unexpected route error.
      </p>
      <button
        className="mt-8 w-fit border border-border px-4 py-2 text-sm font-medium"
        type="button"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  );
}
