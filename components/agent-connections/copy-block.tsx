import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/lib/ui/toast";

/** 붙여 넣을 값 하나와 복사 버튼. 개인 토큰 발급 안내와 OAuth 연결 안내(APP-889)가 같이 쓴다. */
export function CopyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--el-muted)]">{label}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label={`${label} 복사`}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(value)
              .then(() => toast.success(`${label}을(를) 복사했습니다.`))
              .catch(() =>
                toast.error("복사하지 못했습니다. 직접 선택해 복사해 주세요.")
              );
          }}
        >
          <Copy className="size-3.5" />
          복사
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-block bg-[var(--el-canvas-soft)] p-3 font-mono text-xs whitespace-pre-wrap break-all text-[var(--el-ink)]">
        {value}
      </pre>
    </div>
  );
}
