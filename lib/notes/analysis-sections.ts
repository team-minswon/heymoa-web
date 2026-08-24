import type { AnalysisResultResponseDataSectionsItemKind } from "@/lib/api/generated/models";

/**
 * 섹션 이름과 순서. 서버도 같은 순서로 내려주지만 여기서 한 번 더 세운다 — 한 섹션이
 * 통째로 비어 응답에서 빠져도 헤딩 셋은 남아야 "그 칸이 비었다"와 "그 칸이 없다"가
 * 구분된다.
 *
 * **요약 탭과 복사가 같은 표를 본다.** 사본을 두면 한쪽에만 섹션이 추가되어 갈라진다.
 */
export const SECTION_LABELS: Record<
  AnalysisResultResponseDataSectionsItemKind,
  string
> = {
  OVERVIEW: "개요",
  ACTION_ITEM: "액션 아이템",
  DECISION: "결정",
};

export const SECTION_ORDER = Object.keys(
  SECTION_LABELS
) as AnalysisResultResponseDataSectionsItemKind[];
