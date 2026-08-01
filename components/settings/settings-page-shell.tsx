import { SettingsBody, SettingsHead } from "@/components/workspace/page-chrome";

/**
 * 설정 화면 하나의 뼈대. design.pen 기준으로 **제목은 여기 한 곳에서만** 나온다 —
 * 패널 맨 위 hairline 머리(26px 세리프)가 상단바 자리를 겸하고, 그 아래가 본문이다.
 *
 * 폼 컴포넌트가 자기 제목을 또 그리면 같은 말이 두 번 뜬다. 제목은 이 셸이 소유한다.
 * 셸이 `overflow-hidden` 이라 스크롤 경계도 여기서 만든다 — 안 만들면 긴 폼의 아래가 잘린다.
 */
export function SettingsPageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <SettingsHead
        title={title}
        description={description}
        actions={actions}
      />
      <SettingsBody>{children}</SettingsBody>
    </>
  );
}
