import Link from "next/link";

const rebuildSteps = [
  "Auth shell",
  "Public navigation",
  "Onboarding",
  "Dashboard",
  "API keys",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-16">
      <section className="max-w-3xl py-12">
        <p className="font-mono text-sm text-muted-foreground">
          realillust-web rebuild
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-normal text-foreground sm:text-6xl">
          Realillust web is being rebuilt from a clean foundation.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          The active rebuild line keeps the existing history intact while
          restoring product behavior through issue-linked pull requests.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="border border-border px-4 py-2 text-sm font-medium"
            href="/terms"
          >
            Terms
          </Link>
          <Link
            className="border border-border px-4 py-2 text-sm font-medium"
            href="/privacy"
          >
            Privacy
          </Link>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-5">
        {rebuildSteps.map((step, index) => (
          <div key={step} className="border border-border bg-muted p-4">
            <p className="font-mono text-xs text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </p>
            <p className="mt-3 text-sm font-medium">{step}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
