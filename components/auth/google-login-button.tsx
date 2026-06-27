"use client";

import { useState } from "react";
import {
  buildGoogleOAuthUrl,
  getCurrentReturnTo,
  isAuthApiConfigured,
} from "@/lib/auth/paths";

type GoogleLoginButtonProps = {
  compact?: boolean;
};

export function GoogleLoginButton({ compact = false }: GoogleLoginButtonProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleLogin() {
    if (!isAuthApiConfigured) {
      setErrorMessage("API URL is not configured.");
      return;
    }

    setPending(true);
    setErrorMessage(null);

    try {
      window.location.href = buildGoogleOAuthUrl(getCurrentReturnTo());
    } catch {
      setErrorMessage("Could not move to the Google login page.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleLogin}
        disabled={!isAuthApiConfigured || pending}
        className="w-fit border border-border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        {compact
          ? "Google"
          : pending
            ? "Opening Google..."
            : "Continue with Google"}
      </button>
      {errorMessage ? (
        <p className="max-w-64 text-sm text-muted-foreground">{errorMessage}</p>
      ) : null}
    </div>
  );
}
