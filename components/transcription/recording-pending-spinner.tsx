import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function RecordingPendingSpinner() {
  const t = useTranslations("recording");
  return (
    <span
      role="status"
      aria-label={t("pending")}
      className="inline-flex size-8 shrink-0 items-center justify-center"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
    </span>
  );
}
