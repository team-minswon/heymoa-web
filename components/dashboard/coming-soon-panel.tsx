import { Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoonPanel({ title }: { title: string }) {
  return (
    <Card className="rounded-xl border border-dashed border-[var(--clay-hairline)] bg-[var(--clay-surface-soft)] p-8 shadow-none ring-0">
      <CardContent className="p-0">
        <Clock3 className="size-5 text-[var(--clay-muted)]" />
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--clay-muted)]">
          이 영역은 곧 연결됩니다. 지금은 생성된 organization과 멤버 정보를 먼저
          확인할 수 있습니다.
        </p>
      </CardContent>
    </Card>
  );
}
