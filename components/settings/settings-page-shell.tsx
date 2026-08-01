/**
 * 셸이 `h-svh overflow-hidden` 이라 페이지가 스스로 스크롤 경계를 만들어야 한다 —
 * 안 만들면 한 화면보다 긴 내용의 아래쪽이 잘려서 닿을 수 없다.
 *
 * 제목은 선택이다. 기존 설정 폼들(멤버·일반·연동·계정)은 자기 헤더를 이미 갖고 있어서
 * 여기서 또 그리면 같은 제목이 두 벌 뜬다.
 */
export function SettingsPageShell({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[660px] px-8 pb-10 pt-6">
        {title ? (
          <header className="pb-5">
            <h1 className="text-note-title font-serif font-light">{title}</h1>
            {description ? (
              <p className="mt-1 text-[13px] text-[var(--el-muted)]">
                {description}
              </p>
            ) : null}
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}
