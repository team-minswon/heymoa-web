import { AudioLines } from "lucide-react";

import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * 로그인·초대·웰컴이 함께 쓰는 카드. 셋 다 「아직 워크스페이스 안이 아닌」 자리라
 * 같은 형태여야 한 제품으로 읽힌다 — 440 / p32 / gap20 / radius 16 / e3(design.pen).
 *
 * 그림자가 e3 인 게 의도다. 이 화면들에는 떠 있는 층이 카드 하나뿐이라 접지 그림자를
 * 겹치면 오히려 붕 뜬다.
 */
export function AuthCard({
  title,
  description,
  above,
  children,
  footer,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 제목 위에 놓는 것 — 초대 화면의 초대자 아바타처럼. */
  above?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[var(--el-canvas)] px-6 py-16">
      <div
        className={cn(
          "flex w-[440px] max-w-full flex-col items-center gap-5 rounded-panel border border-[var(--el-hairline)] bg-card p-8 shadow-e3",
          className
        )}
      >
        <span className="flex items-center gap-2">
          <AudioLines className="size-5 text-[var(--el-ink)]" />
          <span className="text-[18px] font-bold text-[var(--el-ink)]">
            {siteConfig.name}
          </span>
        </span>
        <div className="flex w-full flex-col items-center gap-2">
          {above}
          <h1 className="text-center font-serif text-note-title leading-[31px] font-light tracking-[-0.8px] text-[var(--el-ink)]">
            {title}
          </h1>
          {description ? (
            <p className="text-center text-[13px] leading-[21px] text-[var(--el-body)]">
              {description}
            </p>
          ) : null}
        </div>
        {children}
      </div>
      {footer}
    </main>
  );
}

/** 진입 화면의 주 액션 — h48 pill. 카드 안에서 유일하게 시선을 끄는 것이라 하나만 둔다. */
export function AuthPrimaryButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--el-primary)] px-6 text-[15px] font-medium text-[var(--el-on-primary)] transition-colors hover:bg-[var(--el-primary-active)] disabled:opacity-50",
        className
      )}
    />
  );
}
