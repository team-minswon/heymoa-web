import { redirect } from "next/navigation";

// 요금제·결제 관리는 설정 창 안에 있다(PRO-75). 옛 주소로 들어오면 그 탭을 연다.
export default async function WorkspaceBillingPaymentRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/w/${workspaceId}?settings=payment`);
}
