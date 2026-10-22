import { CurrentLegalPage, currentLegalMetadata } from "@/app/[lang]/legal-document";

export const dynamic = "force-static";

/**
 * 본문은 언어 파일 `legal.terms`(`messages/<ko|en>/legal.json`)에 있다. 한국어가 정본이고 영어는 참고용 번역이다
 * — 한국어 조항을 고치면 영어도 같은 커밋에서 고친다.
 *
 * 조 번호가 곧 앵커(`#section-N`)다. 조를 넣거나 빼면 뒤 번호가 밀리므로 새 조항은 맨 뒤에 붙인다(APP-1196).
 */
export const generateMetadata = () => currentLegalMetadata("terms");

export default async function TermsPage() {
  return CurrentLegalPage({ doc: "terms" });
}
