import { CurrentLegalPage, currentLegalMetadata } from "@/app/[lang]/legal-document";

export const dynamic = "force-static";

export const generateMetadata = () => currentLegalMetadata("privacy");

/**
 * 본문은 `messages/<ko|en>/legal.json` 의 `legal.privacy` 입니다. 한국어가 정본이고, 한국어를 고치면 영어도 같은 커밋에서 고칩니다.
 * - 조 번호가 앵커(`#section-N`)입니다. 설정·도움말이 `#section-5` 를 가리키므로 조를 넣거나 빼지 않고 새 조항은 맨 뒤에 붙입니다.
 * - 5조 저장 값 표는 `lib/storage/user-flags.ts` 의 키와 같아야 합니다.
 * - 7조 모델 사업자는 heymoa-ai `infrastructure/policies/heymoa.yml` 의 `allowed_providers` 와 같아야 합니다.
 *   PostHog 의 「IP 저장 안 함」은 PostHog 프로젝트의 Discard client IP data 가 켜져 있어야 사실입니다.
 * - 7조는 국외 이전 공개 사항(국가·연락처·항목·시기·목적·보유 기간)을 모두 적습니다(개인정보 보호법 제28조의8).
 * - 8조는 법 제30조의 필수 공개 항목이라 지우지 않습니다.
 */
export default async function PrivacyPage() {
  return CurrentLegalPage({ doc: "privacy" });
}
