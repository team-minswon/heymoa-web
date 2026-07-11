import { LoaderCircle } from "lucide-react";

export default function AuthCallbackLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--clay-canvas)] px-4 py-12 text-[var(--clay-primary)]">
      <div className="text-center">
        <LoaderCircle className="size-12 animate-spin mx-auto text-[var(--clay-primary)] mb-4" />
        <h1 className="text-2xl font-bold text-[var(--clay-primary)]">로그인 중입니다</h1>
        <p className="mt-2 text-[var(--clay-body)]">잠시만 기다려 주세요...</p>
      </div>
    </div>
  );
}
