import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <p className="font-mono text-sm text-muted-foreground">Legal</p>
      <h1 className="mt-4 text-4xl font-semibold">Terms of Service</h1>
      <div className="mt-8 space-y-5 leading-8 text-muted-foreground">
        <p>
          These placeholder terms keep the public route available during the
          rebuild. The final legal copy will be restored or revised in a later
          content pass.
        </p>
        <p>
          By using Realillust, users are expected to follow applicable product
          policies, protect their account access, and use generated outputs
          responsibly.
        </p>
      </div>
    </main>
  );
}
