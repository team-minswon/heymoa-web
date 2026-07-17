import { Loader2 } from "lucide-react";

export function RecordingPendingSpinner() {
  return (
    <span
      role="status"
      aria-label="녹음 처리 중"
      className="inline-flex size-8 shrink-0 items-center justify-center"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
    </span>
  );
}
