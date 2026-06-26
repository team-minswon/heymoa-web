let mockingPromise: Promise<void> | undefined;

export function shouldEnableMocking() {
  return process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
}

export async function enableMocking() {
  if (!shouldEnableMocking() || typeof window === "undefined") {
    return;
  }

  mockingPromise ??= import("@/lib/mocks/browser").then(async ({ worker }) => {
    await worker.start({
      onUnhandledRequest: "bypass",
    });
  });

  await mockingPromise;
}
