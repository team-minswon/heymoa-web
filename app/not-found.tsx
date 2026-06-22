import { SearchX } from "lucide-react";

import { DefaultStatusActions } from "@/components/realillust/status-panel";
import { StatusPage } from "@/components/realillust/status-page";

export default function NotFound() {
  return (
    <StatusPage
      icon={SearchX}
      label="404"
      title="페이지를 찾을 수 없습니다"
      description="주소가 바뀌었거나 더 이상 제공하지 않는 페이지입니다. 홈으로 돌아가 다시 시작해 주세요."
      actions={<DefaultStatusActions />}
    />
  );
}
