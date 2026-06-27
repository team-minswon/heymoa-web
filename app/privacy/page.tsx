import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <p className="font-mono text-sm text-muted-foreground">Legal</p>
      <h1 className="mt-4 text-4xl font-semibold">Privacy Policy</h1>
      <div className="mt-8 space-y-5 leading-8 text-muted-foreground">
        <p>
          This placeholder policy keeps the privacy route available during the
          rebuild. The final policy text will be restored or revised in a later
          content pass.
        </p>
        <p>
          Realillust should only collect the information needed to operate user
          accounts, organization workflows, and API access.
        </p>
      </div>
    </main>
  );
}
