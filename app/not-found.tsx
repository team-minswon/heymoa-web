import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <SearchX className="size-12 text-[var(--clay-muted)] mb-4" />
      <h1 className="text-2xl font-bold text-[var(--clay-primary)]">404 - 페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-[var(--clay-body)]">주소가 바뀌었거나 더 이상 제공하지 않는 페이지입니다.</p>
      <Link href="/" className="mt-6 text-sm font-semibold text-white bg-[var(--clay-primary)] px-4 py-2 rounded-xl">
        홈으로 돌아가기
      </Link>
    </div>
  );
}
