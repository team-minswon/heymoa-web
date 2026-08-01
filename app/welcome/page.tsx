import type { Metadata } from "next";

import { WelcomePage } from "@/components/workspace/welcome-page";

export const metadata: Metadata = {
  title: "시작하기",
  description: "첫 워크스페이스를 만듭니다.",
};

export default function WelcomeRoute() {
  return <WelcomePage />;
}
