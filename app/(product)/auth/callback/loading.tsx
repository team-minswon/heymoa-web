// spinner 글리프는 앱 전체가 `Loader2`다(Button·목록 행·녹음 대기·토스트).
import { Loader2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function AuthCallbackLoading() {
  const t = await getTranslations("auth.callback");
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--el-canvas)] px-4 py-12 text-[var(--el-ink)]">
      <div className="text-center">
        <Loader2 className="mx-auto mb-5 size-8 animate-spin text-[var(--el-ink)]" />
        <h1 className="text-3xl font-light tracking-[-0.025em]">
          {t("signingIn")}
        </h1>
        <p className="mt-2 text-sm text-[var(--el-muted)]">{t("preparing")}</p>
      </div>
    </div>
  );
}
