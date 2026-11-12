import { CardChangeFrame } from "@/components/billing/card-change-frame";

import { loginRequired } from "../../../login-gate";

// 카드 변경 모달 안의 iframe 문서(APP-1600). 머리글·발이 없고(`isChromelessRoute`), 우리 출처만 프레임에 띄울 수 있다.
export default async function CardChangeFrameRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    (await loginRequired()) ?? <CardChangeFrame workspaceId={workspaceId} />
  );
}
