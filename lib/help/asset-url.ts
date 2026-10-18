/**
 * 가이드 이미지·영상 주소는 여기서만 만든다. 지금은 저장소의 `public/help/…`(Vercel 엣지가 서빙)이다.
 *
 * 나중에 AWS(S3 + CloudFront)로 옮기려면: ① 파일을 같은 경로로 버킷에 올리고 ② `NEXT_PUBLIC_HELP_IMAGE_BASE`
 * 에 CDN 주소를 넣고 ③ 호출부는 안 바뀐다(평범한 <img>·<video> 라 `images.remotePatterns` 는 필요 없다).
 */
export const helpAssetUrl = (path: string) =>
  `${(process.env.NEXT_PUBLIC_HELP_IMAGE_BASE ?? "").replace(/\/+$/, "")}/help/${path.replace(/^\/+/, "")}`;
