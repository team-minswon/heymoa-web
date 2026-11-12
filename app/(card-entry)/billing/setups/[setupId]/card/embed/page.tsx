import { renderCardEntry } from "../card-entry-route";

// 카드 입력 모달 안의 iframe(APP-1600). 머리글·발이 없고(`isChromelessRoute`), 우리 출처만 프레임에 띄울 수 있다.
export default function BillingCardEntryFrameRoute({
  params,
}: {
  params: Promise<{ setupId: string }>;
}) {
  return renderCardEntry(params, true);
}
