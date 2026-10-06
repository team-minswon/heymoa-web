import { Landing } from "@/components/heymoa/landing/landing";
import { siteConfig } from "@/lib/site";

/**
 * 검색 결과에 뜨는 기능 목록. 화면의 구간 순서 그대로다(`landing/landing.tsx`) — 구간을 더하거나 빼면
 * 여기도 같이 고친다. 페이지가 말하지 않는 기능을 구조화 데이터만 말하면 검색 결과가 화면과 갈린다.
 */
const FEATURE_LIST = [
  "회의 기록과 결정 · 할 일 정리",
  "결정 · 할 일의 근거 발언 확인",
  "프로젝트별 팀 회의 기록",
  "지난 회의에 묻는 내 에이전트",
  "승인한 것만 Linear · GitHub 로 내보내기",
  "Claude Code · Codex 같은 외부 에이전트 연결",
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  alternateName: ["heymoa", "Hey Moa", "hey moa", "헤이모아", "헤이 모아"],
  applicationCategory: "BusinessApplication",
  // 데스크톱 베타(`app/(static)/download/page.tsx` — macOS DMG · Windows EXE)도 받을 수 있다(FAQ 01).
  operatingSystem: "Web, macOS, Windows",
  url: siteConfig.url,
  description: siteConfig.description,
  featureList: FEATURE_LIST,
  inLanguage: "ko-KR",
};

/**
 * 랜딩. 서버 컴포넌트로 두고, 움직이는 조각(히어로 시연 · 리빌 · 흐르는 띠 · 시작 버튼)만 클라이언트다.
 */
export function LandingClient() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Landing />
    </>
  );
}
