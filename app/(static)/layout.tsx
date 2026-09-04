/**
 * 약관·개인정보가 사는 그룹.
 *
 * **`PageTransition`을 쓰지 않는다.** 그것은 `motion`의 `initial={{opacity:0}}`이라 서버가
 * `opacity:0`인 HTML을 내보내고, 하이드레이션이 끝나야 보인다 — JS를 끄면 문서가 DOM에 다
 * 있는데도 화면이 빈 채로 남는다. 랜딩(`(main)`)에서 같은 이유로 걷어냈고, 여기는 **읽으라고
 * 있는 문서**라 더 그렇다.
 *
 * 이 그룹에는 라우트가 둘뿐이고 서로 오갈 일도 드물어서, 전환이 아니라 첫 페인트를 늦추는
 * 일만 한다.
 */
export default function StaticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
