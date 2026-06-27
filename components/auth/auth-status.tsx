"use client";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { useAuth } from "@/components/auth/auth-provider";
import { isAuthApiConfigured } from "@/lib/auth/paths";

export function AuthStatus() {
  const { user, status, logout, refreshUser } = useAuth();

  if (status === "checking") {
    return (
      <div className="border border-border bg-muted p-4 text-sm text-muted-foreground">
        Checking authentication...
      </div>
    );
  }

  if (status === "authenticated" && user) {
    const displayName = user.name ?? user.email ?? "Authenticated user";

    return (
      <div className="border border-border bg-muted p-4">
        <p className="text-sm font-medium">{displayName}</p>
        {user.email ? (
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="border border-border px-3 py-2 text-sm"
            type="button"
            onClick={() => void refreshUser()}
          >
            Refresh
          </button>
          <button
            className="border border-border px-3 py-2 text-sm"
            type="button"
            onClick={() => void logout()}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthApiConfigured) {
    return (
      <div className="border border-border bg-muted p-4 text-sm text-muted-foreground">
        Set NEXT_PUBLIC_API_BASE_URL to enable Google OAuth.
      </div>
    );
  }

  return <GoogleLoginButton />;
}
