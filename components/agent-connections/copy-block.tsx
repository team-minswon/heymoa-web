import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { objectParticle } from "@/components/settings/confirm-phrase-field";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/ui/copy-text";
import { toast } from "@/lib/ui/toast";

/**
 * 붙여 넣을 값 하나와 복사 버튼. 개인 토큰 발급 안내와 OAuth 연결 안내(APP-889)가 같이 쓴다.
 * `inline` 은 연결 안내(APP-1031)의 모양이다 — 라벨 줄 없이 블록 안에 복사 아이콘을 둬 단계 문장 바로 아래에 붙는다.
 * 라벨은 복사 버튼의 이름과 토스트에만 쓴다. `text` 는 마케팅 면(다운로드)이 자기 언어 파일의 버튼 이름과 토스트를 통째로 넘긴다.
 * 기본 문구가 `common` 에 있는 것은 두 루트가 모두 그 이름공간을 내려 받기 때문이다.
 */
export function CopyBlock({
  label,
  value,
  inline = false,
  text,
}: {
  label: string;
  value: string;
  inline?: boolean;
  text?: { copy: string; copied: string; failed: string };
}) {
  const t = useTranslations("common");
  const words = text ?? {
    copy: t("copyBlock.copy", { label }),
    copied: t("copyBlock.copied", { label, particle: objectParticle(label) }),
    failed: t("copyBlock.failed"),
  };
  const copy = () => {
    void copyText(value)
      .then(() => toast.success(words.copied))
      .catch(() => toast.error(words.failed));
  };
  if (inline) {
    return (
      <div className="flex items-center gap-2 rounded-block bg-[var(--el-canvas-soft)] py-2 pr-2 pl-3.5">
        <pre className="min-w-0 flex-1 font-mono text-xs whitespace-pre-wrap break-words text-[var(--el-ink)]">
          {value}
        </pre>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-[var(--el-muted)] hover:text-[var(--el-ink)]"
          aria-label={words.copy}
          onClick={copy}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--el-muted)]">{label}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label={words.copy}
          onClick={copy}
        >
          <Copy className="size-3.5" />
          {t("actions.copy")}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-block bg-[var(--el-canvas-soft)] p-3 font-mono text-xs whitespace-pre-wrap break-all text-[var(--el-ink)]">
        {value}
      </pre>
    </div>
  );
}
