import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-4 text-3xl font-semibold">Page not found</h1>
      <p className="mt-4 text-muted-foreground">
        The requested route is not part of the current rebuild stage.
      </p>
      <Link className="mt-8 text-sm font-medium underline" href="/">
        Go home
      </Link>
    </main>
  );
}
