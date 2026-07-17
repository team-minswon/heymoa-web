"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { isAuthApiConfigured } from "@/lib/auth/paths";

export function AuthStatus() {
  const { user, status } = useAuth();

  if (status === "checking") {
    return (
      <Button
        type="button"
        variant="outline"
        loading
        disabled
        aria-label="로그인 상태 확인 중"
        className="rounded-full font-medium"
      >
        로그인
      </Button>
    );
  }

  if (status === "authenticated" && user) {
    return null;
  }

  if (!isAuthApiConfigured) {
    return (
      <Button
        type="button"
        variant="outline"
        className="rounded-full font-medium"
        disabled
      >
        로그인
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <AuthModal>
        <Button
          variant="outline"
          className="rounded-full font-medium sm:hidden"
        >
          로그인
        </Button>
      </AuthModal>
      <AuthModal>
        <Button
          variant="outline"
          className="hidden sm:inline-flex rounded-full font-medium"
        >
          로그인
        </Button>
      </AuthModal>
    </div>
  );
}
