import { AuthStatus } from "@/components/auth/auth-status";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
      <div className="max-w-2xl">
        <p className="font-mono text-sm text-muted-foreground">
          realillust-web rebuild
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
          Application foundation is ready.
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          This branch restores a small, stable shell for rebuilding auth,
          onboarding, dashboard, generated API clients, mocks, and API key
          management through issue-linked PRs.
        </p>
      </div>
      <dl className="mt-12 grid gap-3 sm:grid-cols-3">
        {[
          ["Base", "Next App Router"],
          ["Flow", "dev rebuild"],
          ["Parity", "tracked in #13"],
        ].map(([label, value]) => (
          <div key={label} className="border border-border bg-muted p-4">
            <dt className="font-mono text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-12 max-w-md">
        <h2 className="text-lg font-semibold">Auth shell</h2>
        <div className="mt-4">
          <AuthStatus />
        </div>
      </section>
    </main>
  );
}
