import { LoaderCircle } from "lucide-react";

import { StatusPage } from "@/components/realillust/status-page";

export default function Loading() {
  return (
    <StatusPage
      icon={LoaderCircle}
      iconClassName="animate-spin"
      label="Loading"
      title="페이지를 불러오는 중"
      description="요청한 화면을 준비하고 있습니다."
      withoutShell
    />
  );
}
