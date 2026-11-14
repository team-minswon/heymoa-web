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
    // 로컬 전용 프로젝트(public/mock-local, git 제외). 워커가 켜지기 전이라 이 요청은 가로채이지 않는다.
    const { loadLocalProjects } = await import("@/lib/mocks/local-projects");
    await loadLocalProjects();
    await worker.start({
      onUnhandledRequest: "bypass",
      // 카드 입력 화면에서는 요청 기록(본문 = 카드 번호)을 콘솔에 찍지 않는다(APP-1600). 그 화면은 문서를 새로 열어 들어오므로
      // 이 판정은 그 문서에만 걸리고, 다른 화면의 목 디버깅 기록은 그대로다.
      quiet: isCardEntryPath(window.location.pathname),
    });
  });

  await mockingPromise;
}
