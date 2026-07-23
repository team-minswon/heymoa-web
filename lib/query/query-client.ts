import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessageOf } from "@/lib/api/error-message";

/**
 * mutation이 실패하면 기본으로 토스트를 띄운다.
 *
 * 실패를 화면에 인라인으로 그리면 레이아웃이 흔들린다 — 방금 누른 버튼 옆에 문구가
 * 끼어들면서 아래가 밀린다. mutation 실패는 **사용자가 방금 한 행동에 대한 응답**이라
 * 사라져도 되므로 토스트가 맞다.
 *
 * `meta.suppressErrorToast: true`면 건너뛴다. 이유는 둘이다.
 *
 * 1. **화면이 인라인으로 그린다** — 지속 상태(입력 잠금, 회의 비ACTIVE, 승인 카드 무효화)와
 *    주 데이터 실패(노트 404, 분석 FAILED, 끊긴 스트림). 판정 기준은 `AGENTS.md`
 *    "오류·로딩 표시 경계"에 있다
 * 2. **호출부가 이미 자기 토스트를 띄운다** — 실패 코드에 따라 문구가 갈리는 곳
 *    (프로젝트 삭제의 "노트가 있어 삭제할 수 없습니다" 등). 여기서 또 띄우면 두 개가 겹친다
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.suppressErrorToast) return;
        toast.error(errorMessageOf(error, "요청을 처리하지 못했습니다."));
      },
    }),
  });
}
