/**
 * 랜딩 하나만 사는 그룹이다.
 *
 * **`PageTransition`을 쓰지 않는다.** 그것은 `motion`의 `initial={{opacity:0}}`이라 서버가
 * `opacity:0`인 HTML을 내보내고, 하이드레이션이 끝나야 보인다 — JS를 끄면 9개 밴드가 DOM에
 * 다 있는데도 화면이 빈 채로 남는다(프로덕션 빌드에서 확인). 게다가 이 그룹에는 라우트가
 * 하나뿐이라 `key={pathname}`이 바뀔 일이 없어서, 전환이 아니라 첫 페인트를 200ms 늦추는
 * 일만 한다. 랜딩은 정지 조판이고(DESIGN.md) 서버 컴포넌트로 둔 이유도 그것이다.
 *
 * `(static)` 쪽은 아직 그대로다 — 같은 문제가 있지만 이번 작업 범위 밖이다.
 */
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
