import { CurrentLegalPage, currentLegalMetadata } from "@/app/[lang]/legal-document";

export const dynamic = "force-static";

/**
 * 본문은 언어 파일 `legal.privacy`(`messages/<ko|en>/legal.json`)에 있다. 한국어가 정본이고 영어는 참고용 번역이다
 * — 한국어 조항을 고치면 영어도 같은 커밋에서 고친다. JSON 에는 주석을 못 달아 문단별 주의를 여기 둔다.
 *
 * - 조 번호가 곧 앵커(`#section-N`)다. 계정 설정이 `/privacy#section-5`(자동 수집 장치와 거부 방법)를 가리키므로 조를 넣거나
 *   빼지 않는다. 새 조항은 맨 뒤에 붙인다(APP-1196).
 * - 5조 저장 값 표(브라우저에 저장하는 값): 키 목록의 원본은 `lib/storage/user-flags.ts` 머리 주석이다. 새 키를
 *   만들면 이 표도 고친다.
 * - 5조 거부 방법은 브라우저 설정이다. 설정의 「이용 통계 보내기」 스위치는 없앴다(APP-1385). 도움말이 `#section-5` 를 가리킨다.
 * - 5조 서버 사건 문단: 서버가 보내는 제품 사건(heymoa-server APP-1071)은 브라우저의 거부를 모른다. 사건을 더하거나
 *   빼면 이 문장을 같이 고친다.
 * - 7조 OpenRouter 카드: 게이트웨이는 OpenRouter 다(heymoa-ai `llm/web_search.py` 의 `openrouter:web_search`).
 *   모델 사업자는 `infrastructure/policies/heymoa.yml` 의 `allowed_providers` 와 같아야 한다.
 * - 7조 PostHog 카드: 「IP는 저장하지 않음」은 PostHog 프로젝트 설정의 Discard client IP data 가 켜져 있어야
 *   사실이다(APP-1068에서 켬). 보관 1년은 무료 요금제 기준이다. 요금제를 바꾸면 여기와 시행일을 같이 고친다.
 * - 7조 카드는 국외 이전 공개 사항(국가·연락처·항목·시기·목적·보유 기간)을 모두 적는다(법 제28조의8). 값의 근거는 docs
 *   `projects/PRO-69-…/docs/integration.md` 다. `{확인 필요}` 는 아직 확인하지 못한 칸이다 — 시행 전에 채운다.
 * - 6조 보관 표는 PRO-69 PRD 「보관 결정」과 같아야 한다.
 * - 8조는 법 제30조의 필수 공개 항목이다. 조항을 다시 쓰더라도 지우지 않는다.
 */
export const generateMetadata = () => currentLegalMetadata("privacy");

// 서버 컴포넌트를 바로 불러 그린 결과를 돌려준다 — 테스트가 `await Page()` 로 그대로 그린다.
export default async function PrivacyPage() {
  return CurrentLegalPage({ doc: "privacy" });
}
