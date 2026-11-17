import { isCardEntryPath } from "@/lib/billing/card-entry-csp";

let mockingPromise: Promise<void> | undefined;

export function shouldEnableMocking() {
  return process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
}

export async function enableMocking() {
  if (!shouldEnableMocking() || typeof window === "undefined") {
    return;
  }

  mockingPromise ??= import("@/lib/mocks/browser").then(async ({ worker }) => {
    const { loadLocalProjects } = await import("@/lib/mocks/local-projects");
    await loadLocalProjects();
    await worker.start({
      onUnhandledRequest: "bypass",
      quiet: isCardEntryPath(window.location.pathname),
    });
  });

  await mockingPromise;
}
