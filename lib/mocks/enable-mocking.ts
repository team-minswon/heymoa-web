let mockingPromise: Promise<void> | undefined;

export function shouldEnableMocking() {
  return process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
}

export async function enableMocking() {
  if (!shouldEnableMocking() || typeof window === "undefined") {
    return;
  }

  mockingPromise ??= import("@/lib/mocks/browser").then(async ({ worker }) => {
    // 로컬 전용 프로젝트(public/mock-local, git 제외). 워커가 켜지기 전이라 이 요청은 가로채이지 않는다.
    const { loadLocalProjects } = await import("@/lib/mocks/local-projects");
    await loadLocalProjects();
    await worker.start({
      onUnhandledRequest: "bypass",
    });
  });

  await mockingPromise;
}
