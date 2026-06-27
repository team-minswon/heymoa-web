"use client";

import { useEffect, useState } from "react";

import { enableMocking, shouldEnableMocking } from "@/lib/mocks/enable-mocking";

const MOCK_START_TIMEOUT_MS = 3000;

export function MockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!shouldEnableMocking());

  useEffect(() => {
    let mounted = true;

    async function startMocks() {
      if (!shouldEnableMocking()) {
        return;
      }

      await Promise.race([
        enableMocking(),
        new Promise<void>((resolve) =>
          window.setTimeout(resolve, MOCK_START_TIMEOUT_MS)
        ),
      ]);
    }

    startMocks()
      .catch((error) => {
        console.error("Failed to start API mocks.", error);
      })
      .finally(() => {
        if (mounted) {
          setReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
