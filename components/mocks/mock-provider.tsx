"use client";

import { useEffect, useState, type ReactNode } from "react";

const shouldEnableMocking =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

type MockProviderProps = {
  children: ReactNode;
};

export function MockProvider({ children }: MockProviderProps) {
  const [ready, setReady] = useState(!shouldEnableMocking);

  useEffect(() => {
    if (!shouldEnableMocking) {
      return;
    }

    let cancelled = false;

    async function enableMocking() {
      const { worker } = await import("@/lib/mocks/browser");

      await worker.start({
        onUnhandledRequest: "bypass",
      });

      if (!cancelled) {
        setReady(true);
      }
    }

    void enableMocking();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
