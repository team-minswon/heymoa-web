"use client";

import { LogOut, UserRound } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { AuthModal } from "@/components/auth/auth-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isAuthApiConfigured } from "@/lib/auth/paths";

function getUserInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

export function AuthStatus() {
  const { user, status, logout } = useAuth();

  if (status === "checking") {
    return (
      <div className="inline-flex h-10 items-center rounded-full border border-[var(--el-hairline)] px-3 text-xs font-medium text-[var(--el-muted)] sm:px-4 sm:text-sm">
        로그인 확인 중
      </div>
    );
  }

  if (status === "authenticated" && user) {
    return null;
  }

  if (!isAuthApiConfigured) {
    return (
      <div className="inline-flex h-10 items-center rounded-full border border-red-500 bg-[var(--el-surface)] px-3 text-xs font-medium text-red-500 sm:px-4">
        API URL 미설정
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <AuthModal>
        <Button variant="outline" className="rounded-full font-medium sm:hidden">
          로그인
        </Button>
      </AuthModal>
      <AuthModal>
        <Button variant="outline" className="hidden sm:inline-flex rounded-full font-medium">
          로그인
        </Button>
      </AuthModal>
    </div>
  );
}
