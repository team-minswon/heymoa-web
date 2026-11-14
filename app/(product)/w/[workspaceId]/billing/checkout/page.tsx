import { redirect } from "next/navigation";

// 첫 구독은 전용 결제 페이지다(APP-1600). 옛 주문서 주소로 들어오면 그 페이지로 보낸다.
export default async function WorkspaceBillingCheckoutRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/billing/checkout/${workspaceId}`);
}
