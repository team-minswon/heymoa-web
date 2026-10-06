/**
 * 얼굴 열쇠. 랜딩의 지어낸 참석자가 어느 판에서나 같은 얼굴로 서게 하는 지도 하나만 둔다
 * (옛 섹션 도우미는 APP-934 에서 걷었다 — 치수는 `tokens.ts`).
 *
 * **이름이 아니라 변하지 않는 식별자다** — 앱도 계정 · 임시 참여자 식별자로 얼굴을 그린다
 * (`personAvatarKey`). 같은 열쇠가 화면마다 같은 얼굴을 내므로, 히어로 · 작동 방식 · 기능 소개가
 * 모두 이 지도를 쓴다. 판마다 열쇠를 따로 지으면 같은 사람이 띠마다 다른 얼굴로 선다.
 *
 * 이름이 안 붙은 화자는 이것과 **다르다** — `unnamedSpeakerAvatarKey`로 그려서, 앱에서도 화자 A와
 * 김민서는 이름을 이어 주기 전까지 다른 얼굴이다.
 */
export const FACE_KEY: Record<string, string> = {
  김민서: "landing:kim-minseo",
  박지훈: "landing:park-jihoon",
  이서연: "landing:lee-seoyeon",
  정우재: "landing:jeong-woojae",
};
